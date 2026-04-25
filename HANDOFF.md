# Team handoff

A 60-second checklist for collaborators cloning this repo. The full project narrative lives in [`README.md`](./README.md).

> **Private repo.** Do not fork publicly. The `api/.env` file in this snapshot contains a real Anthropic key + workshop AWS session credentials.

## Quickstart

**Prerequisites**: Python 3.13, Node.js 22+, [`ffmpeg`](https://ffmpeg.org/) (for the Transcribe Streaming path).

```bash
# Backend
cd api
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # .env is already in place

# Frontend (separate terminal)
cd web
npm install
npm run dev   # .env.local is already in place
```

Open <http://localhost:3000>.

## Seed sandbox data

The bunq sandbox starts empty. Top up + add realistic merchant transactions in one call:

```bash
curl -X POST http://localhost:8000/sandbox/seed | jq
```

This is idempotent (skips if already run). Force a re-seed with `?force=true`.

## Live deployments

- **Frontend**: <https://teller-eight.vercel.app> (Vercel · CLI deploys)
- **Backend**:  <https://teller-api.fly.dev> (Fly.io · `ams` region)

```bash
# Ship a frontend change
cd web && vercel deploy --prod --yes && vercel alias set <new-url> teller-eight.vercel.app

# Ship a backend change
cd api && flyctl deploy --remote-only
```

## Credentials

`api/.env` (committed in this private snapshot, gitignored elsewhere):

- **`ANTHROPIC_API_KEY`** — long-lived. Used only as a fallback when `USE_BEDROCK=false`.
- **`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`** — workshop STS session creds. **They expire.** When Bedrock / Transcribe / S3 start returning `ExpiredToken`, refresh from the workshop console and overwrite the three lines.
- **`BUNQ_API_KEY`** — leave empty. First boot creates a sandbox user and caches the key in `api/.bunq_sandbox_key` (gitignored, persisted to a Fly volume in prod).

## Two remotes

```text
mine     → github.com/andreaskruszakin/instant-claim   (primary, Vercel deploys from here)
handoff  → github.com/Pukhaan/instant-claim            (team mirror — David also pushes here)
```

`git push` defaults to `mine`. **Don't force-push `handoff`** — David's work lives there.

## Troubleshooting

- **`AWS_AUTH_CREDENTIALS_PROVIDER_IMDS_SOURCE_FAILURE` from Transcribe Streaming** → AWS session creds expired. Refresh `AWS_*` env vars.
- **`asyncio.run() cannot be called from a running event loop`** → already fixed in `transcribe.py`; if it returns, you're calling `asyncio.run` from inside a FastAPI request — use `_run_in_thread_loop` instead.
- **Build error `Cannot read properties of null (reading 'matches')`** during `npm install` → wipe and retry: `rm -rf web/node_modules web/package-lock.json && cd web && npm install`.
- **`/api/*` returns 502 in prod** → Fly machine likely paused. `flyctl machine list -a teller-api` and `flyctl machine start <id>`.

For everything else (architecture, tech choices, demo walkthrough), see [`README.md`](./README.md).
