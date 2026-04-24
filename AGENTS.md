# AGENTS.md

## Learned User Preferences

## Learned Workspace Facts

- This repo is **Teller**, a bunq AI Agents hackathon entry — a multi-modal bunq co-pilot (voice, image, proactive) that takes real actions via the bunq sandbox API.
- Monorepo layout at root: `api/` (Python 3.13 FastAPI backend), `web/` (Next.js 16 frontend, pnpm), `hackathon_toolkit/` (official bunq toolkit, reference + runnable tutorials), `docs/` (`PLAN.md`, `CHANGELOG.md`).
- Judging weights drive priorities: Innovation 25% · Impact 30% · Technical Execution 20% · bunq Integration 15% · Presentation ~10%.
- Backend runs on `http://localhost:8000`; frontend calls same-origin and proxies to the backend via the Next.js `/api/[...path]` catch-all route. Do not introduce cross-origin calls in frontend code.
- Backend uses the toolkit's `BunqClient` (copied into `api/app/bunq_client.py` with attribution), NOT the official `bunq_sdk`. Keep it that way — the toolkit client is purpose-built and smaller.
- bunq auth flow (installation → device-server → session-server) is handled by `BunqClient`; session context is cached in `api/bunq_context.json` (gitignored). First backend run auto-creates a sandbox user if `BUNQ_API_KEY` is empty.
- Prefer bunq `POST /draft-payment` (no RSA signing, confirmed in the bunq app) over `POST /payment` for all demo actions; only touch `/payment` as a late stretch.
- Guardian / proactive feature uses bunq webhooks (`notification-filter-url`, toolkit Tutorial 07), not polling.
- Backend host target is Fly.io or Render — avoid Vercel Python serverless because its 10s timeout breaks the Claude tool-use agent loop and SSE.
- LLM is Anthropic Claude via the direct API (not Bedrock). AWS is used for Transcribe (STT streaming), Polly (TTS), S3 (receipt uploads), and Lambda (guardian cron).
- `web/AGENTS.md` is authoritative for the frontend: this is Next.js 16 with breaking changes — consult `web/node_modules/next/dist/docs/` before writing Next.js code; do not assume prior-version APIs.
- Never commit `BUNQ_API_KEY`, `.env*`, `.bunq_sandbox_key`, `bunq_context.json`, AWS workshop credentials, or any sandbox/OAuth secrets; treat them all as gitignored regardless of extension.
