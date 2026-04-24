# Teller · Instant Claim — team snapshot

A one-shot snapshot of the `Teller` / `Instant Claim` hackathon build. Everything
you need to clone, install, and run is in this repo — including live API
credentials in the `api/.env` and `web/.env.local` files.

> **This is a private team repo.** Do not fork publicly. The Anthropic key here
> is a real billable key; the AWS creds are workshop session credentials and
> expire after a few hours.

## What's inside

- `api/` — FastAPI backend. Anthropic Claude (via **AWS Bedrock**, Sonnet 4.5),
  AWS Transcribe / Polly / S3, bunq sandbox client.
- `web/` — Next.js 16 frontend. Chat-first UI, live voice input, in-chat claim
  flow (A-to-Z insurance triage), camera receipt scan.
- `docs/PLAN.md` — the 24h attack plan mapped to judging criteria.
- `docs/CHANGELOG.md` — reverse-chronological log of every change.
- `hackathon_toolkit/` — the official bunq toolkit (reference).

## Live

- Frontend: <https://teller-eight.vercel.app>
- Backend:  <https://teller-api.fly.dev> (`/health` for status)

## Run it locally

Two terminals.

**Backend**

```bash
cd api
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# .env is already committed in this snapshot — no copying needed.
uvicorn app.main:app --reload --port 8000
```

First run auto-creates a new bunq sandbox user. To re-seed the account with
€20K + 10 realistic merchant payments so claims have purchase matches:

```bash
curl -X POST http://localhost:8000/sandbox/seed
```

**Frontend**

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>.

## Credentials (what's in the .env files)

`api/.env`:

- `ANTHROPIC_API_KEY` — only used as a fallback if `USE_BEDROCK=false`.
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` — workshop
  STS session creds. **These expire.** If Bedrock / Transcribe / S3 start
  returning `ExpiredToken`, grab fresh creds from the workshop console and
  overwrite these three lines.
- `BUNQ_API_KEY` — leave empty; the app auto-creates a sandbox user and caches
  the key in `api/.bunq_sandbox_key` (gitignored).

`web/.env.local`:

- `API_BASE_URL` — where the Next.js proxy forwards `/api/*` traffic. Default
  `http://localhost:8000`. Override to `https://teller-api.fly.dev` to point
  local dev at prod.

## Deploy

- Backend → Fly.io: `cd api && flyctl deploy --remote-only`
- Frontend → Vercel: `cd web && vercel deploy --prod --yes && vercel alias set <new-url> teller-eight.vercel.app`

The Fly.io app already has all the AWS + Anthropic secrets set via
`flyctl secrets set`.
