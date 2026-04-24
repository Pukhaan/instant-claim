# Deploy runbook — Teller

Split stack: Next.js on Vercel, FastAPI on Fly.io.

```
Browser → Vercel (Next.js) → /api/[...path] proxy → Fly.io (FastAPI)
                                                       ├── bunq sandbox
                                                       ├── Anthropic
                                                       └── AWS (workshop creds)
```

## One-time: auth the two CLIs

```bash
# Fly (you'll need to create a free account if you don't have one)
fly auth login

# Vercel (free Hobby tier is fine)
vercel login
```

Both open a browser. Come back when signed in.

## Backend — Fly.io

All commands run from `api/`:

```bash
cd api

# First-time app + volume provisioning
fly apps create teller-api --org personal
fly volumes create teller_state --region ams --size 1 --yes

# Secrets. Copy from api/.env — DO NOT use --set-with-env unless you trust it.
fly secrets set \
  ANTHROPIC_API_KEY="$(grep '^ANTHROPIC_API_KEY=' .env | cut -d= -f2-)" \
  AWS_ACCESS_KEY_ID="$(grep '^AWS_ACCESS_KEY_ID=' .env | cut -d= -f2-)" \
  AWS_SECRET_ACCESS_KEY="$(grep '^AWS_SECRET_ACCESS_KEY=' .env | cut -d= -f2-)" \
  AWS_SESSION_TOKEN="$(grep '^AWS_SESSION_TOKEN=' .env | cut -d= -f2-)" \
  AWS_DEFAULT_REGION=us-east-1 \
  CORS_ORIGINS=https://teller.vercel.app

# Deploy
fly deploy

# Smoke
curl https://teller-api.fly.dev/health | jq
```

### Rotating AWS workshop creds (they expire every 4–12h)

From the Workshop Studio dashboard → nav drawer → **Get AWS CLI credentials**, copy the four `export` lines, then:

```bash
cd api
# paste into api/.env locally so this stays single-source-of-truth
# then push to fly:
fly secrets set \
  AWS_ACCESS_KEY_ID="ASIA..." \
  AWS_SECRET_ACCESS_KEY="..." \
  AWS_SESSION_TOKEN="..."
```

Fly will restart the machine once the secrets land.

## Frontend — Vercel

All commands run from `web/`:

```bash
cd web

# First-time link (pick or create a project)
vercel link --yes

# Env vars (Production + Preview)
vercel env add API_BASE_URL production   # paste: https://teller-api.fly.dev
vercel env add API_BASE_URL preview      # paste: https://teller-api.fly.dev

# Deploy
vercel deploy --prod
```

You'll get something like `https://teller-<hash>.vercel.app` and `https://teller.vercel.app`.

After the first deploy, update Fly's `CORS_ORIGINS` to include the real Vercel URL:

```bash
cd api
fly secrets set CORS_ORIGINS="https://teller.vercel.app,https://teller-*.vercel.app"
```

## Validation (5 min)

```bash
# 1. Direct backend
curl https://teller-api.fly.dev/health | jq

# 2. Through the Vercel proxy (tests CORS + route forwarding)
curl https://teller.vercel.app/api/health | jq

# 3. Streaming chat (should start emitting `data: {...}` lines within 2s)
curl -N https://teller.vercel.app/api/chat \
  -H "content-type: application/json" \
  -d '{"session_id":"deploy-smoke","message":"what accounts do I have?"}' | head -c 1000

# 4. Open the browser
open https://teller.vercel.app
```

## Known limitations

- In-memory chat session dict resets on redeploy. Fine for demo; swap to Redis/Postgres for real.
- AWS session token expires every 4–12h. Rotate using the block above.
- Vercel preview builds need `API_BASE_URL` set for every environment, not just production.

## If Fly falls over

`min_machines_running = 1` in `fly.toml` keeps one warm machine. If you see 502s:

```bash
fly status
fly logs
fly machine restart <id>
```
