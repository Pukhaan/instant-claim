# AGENTS.md

## Learned User Preferences

- Chat-first single-flow UX: chat is the landing experience on the Teller domain; debug/sandbox lives in the top-right corner; receipts trigger via a camera button — don't scatter modes across separate pages.
- The claim flow starts from natural language ("my laptop's broken", "my phone is broken", "stolen luggage at the airport"), not from an explicit "I have a claim" button — keep that trigger conversational.
- AWS-only for model inference. Don't reintroduce direct Anthropic API, Bedrock alternatives, or cross-provider LLM fallbacks; this was corrected twice emphatically.
- Voice round-trip target is ~2s end-to-end, not 8–10s. Use AWS Transcribe Streaming with partial results, not post-hoc transcription, and surface live waveforms while speaking.
- Do not give users audio re-listen of their own recordings in the voice UI.
- When implementing from a plan file, never edit the plan itself and don't re-create already-seeded todos — start the first one in-progress and execute through without stopping to confirm.
- Execute first, summarise after — favor opinionated deploy/implementation decisions over option lists, and keep pre-work narration minimal.

## Learned Workspace Facts

- This repo is **Teller** (bunq AI Agents hackathon entry), currently focused on the **Instant Claim** flow — a multi-modal insurance claim copilot covering bunq's travel + device coverage (voice + receipt photo + transaction cross-check → auto-approve or escalate).
- Monorepo layout at root: `api/` (Python 3.13 FastAPI), `web/` (Next.js 16, pnpm), `hackathon_toolkit/` (official bunq toolkit, reference + runnable tutorials), `docs/` (`PLAN.md`, `CHANGELOG.md`).
- Judging weights drive priorities: Innovation 25% · Impact 30% · Technical Execution 20% · bunq Integration 15% · Presentation ~10%.
- Prod: backend `https://teller-api.fly.dev` (Fly app `teller-api`, region `ams`, shared-cpu-1x / 512 MB, `min_machines_running = 1`, 1 GB persistent volume `teller_state` mounted at `/app/state` holding `.bunq_sandbox_key`, `bunq_context.json`, `enrichments.json`); frontend `https://teller-eight.vercel.app` (Vercel). Vercel is **frontend only** — FastAPI must stay on Fly because ephemeral serverless FS breaks bunq session files and kills the SSE stream on the `/chat` agent loop.
- Local: backend runs on `http://localhost:8000`; frontend calls same-origin via the Next.js `/api/[...path]` catch-all proxy — never introduce cross-origin calls in frontend code.
- All LLM traffic goes through `api/app/llm.py` using `anthropic.AnthropicBedrock` in `us-east-1` with the AWS workshop session creds. The four call sites (`agent`, `claims`, `receipts`, `photo_classify`) funnel through it. The direct `api.anthropic.com` path is dead code behind `USE_BEDROCK=false`.
- AWS-only service stack: Bedrock (LLM), Transcribe Streaming (STT, partials <500ms), Polly (TTS), S3 (receipts). No other inference or TTS/STT providers.
- bunq access uses the toolkit-derived `BunqClient` (`api/app/bunq_client.py`), not `bunq_sdk`. Auth flow (installation → device-server → session-server) is handled by `BunqClient`; session context cached in `bunq_context.json` (gitignored locally, lives on the Fly volume in prod). First backend boot auto-creates a sandbox user if `BUNQ_API_KEY` is empty. Prefer `POST /draft-payment` over `POST /payment` for demo actions; Guardian proactive feature uses bunq webhooks (`notification-filter-url`, toolkit Tutorial 07), not polling.
- Sandbox seed lives at `api/app/seed.py` + `POST /sandbox/seed`: tops up ~€20K via batched Sugar Daddy `request-inquiry` calls, then emits ~10 payments to realistic merchants (iPhone, MacBook, coffee, restaurants) so the claim flow can match purchases. Idempotent via a flag file.
- `web/AGENTS.md` is authoritative for the frontend: this is Next.js 16 with breaking changes — consult `web/node_modules/next/dist/docs/` before writing Next.js code; don't assume prior-version APIs.
- The public team-snapshot repo `https://github.com/Pukhaan/instant-claim` (**private** on GitHub) is wired as the `handoff` git remote and is force-pushed on demand with baked-in secrets so collaborators can run it. Local `main` has no `origin`; Fly and Vercel deployments do not rely on git remotes.
- Never commit `BUNQ_API_KEY`, `.env*`, `.bunq_sandbox_key`, `bunq_context.json`, AWS workshop session creds, or any sandbox/OAuth secrets to any public remote — `Pukhaan/instant-claim` is the only exception (private snapshot repo, by explicit user request).
