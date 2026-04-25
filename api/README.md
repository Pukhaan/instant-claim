# `api/` — Instant Claim backend

FastAPI + Python 3.13. Wraps the bunq sandbox, exposes a Claude tool-use agent, and runs the multi-modal claim-triage pipeline.

## First run

```bash
cd api
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in AWS_* (workshop session creds), ANTHROPIC_API_KEY (fallback only).
# Leave BUNQ_API_KEY empty — first boot creates a sandbox user.
uvicorn app.main:app --reload --port 8000
```

Sanity-check the auth chain + AWS access:

```bash
curl -s http://localhost:8000/health | jq
curl -s http://localhost:8000/aws/probe | jq    # bedrock / transcribe / polly / s3
curl -s http://localhost:8000/accounts | jq

# Seed the sandbox account with €20K + 10 realistic merchant payments so
# the claim flow has purchases to match against.
curl -X POST http://localhost:8000/sandbox/seed | jq
```

For Transcribe Streaming you also need `ffmpeg` on PATH (`brew install ffmpeg` on macOS / `apt install ffmpeg` on Linux). Without it the route falls back to AWS Transcribe batch (~17s vs ~3s).

## Layout

```
api/
├── app/
│   ├── main.py            FastAPI app + routes
│   ├── config.py          pydantic-settings + .env
│   ├── llm.py             single AnthropicBedrock client (4 call sites funnel here)
│   ├── agent.py           Teller agent — Claude tool-use loop over bunq ops
│   ├── tool_defs.py       JSON-schema tool definitions for the agent
│   ├── claims.py          claim-triage pipeline (vision + LLM + bunq + policy)
│   ├── photo_classify.py  fast Claude Vision classifier (kind / subject / summary)
│   ├── receipts.py        receipt OCR + bunq tx match
│   ├── transcribe.py      AWS Transcribe Streaming (default) + batch fallback
│   ├── seed.py            sandbox seed runner
│   ├── aws_probe.py       AWS service status probe (used by /health)
│   ├── bunq_client.py     RSA-signed bunq HTTP client (toolkit-derived)
│   ├── bunq_service.py    typed high-level bunq ops the agent calls
│   └── routes/
│       ├── chat.py        SSE-streamed Claude chat endpoint
│       ├── claim.py       /claim — full multi-modal pipeline
│       ├── classify.py    /classify-photo
│       ├── receipt.py     /receipt
│       └── voice.py       /transcribe
├── Dockerfile             Python 3.13 + ffmpeg
├── fly.toml               Fly app config (ams, persistent volume)
└── requirements.txt
```

## Key endpoints

| Method · Path | What it does |
|---------------|--------------|
| `GET /health` | bunq + Anthropic + AWS service status |
| `GET /aws/probe` | Bedrock / Transcribe / Polly / S3 reachability |
| `GET /accounts` | Live `/monetary-account-bank` from bunq |
| `GET /accounts/{id}/transactions` | Live `/payment` history |
| `POST /chat` | SSE-streamed Claude tool-use agent |
| `POST /classify-photo` | Claude Vision: damage / receipt / other + subject |
| `POST /receipt` | Receipt OCR + bunq tx match + local enrichment store |
| `POST /transcribe` | webm/opus → text via Transcribe Streaming (with batch fallback) |
| `POST /claim` | Full multi-modal claim pipeline (photo + audio/transcript + coverage) |
| `POST /sandbox/topup` | `POST /request-inquiry` to `sugardaddy@bunq.com` for €500 |
| `POST /sandbox/seed` | Idempotent €20K + 10 merchant payment seed |

## Why the bunq client is copied, not imported

The toolkit's `bunq_client.py` lives under `/hackathon_toolkit/` for reference + runnable tutorials. A lightly-edited copy at `app/bunq_client.py` makes this backend self-contained and deployable without path hacks. Attribution is in the file header.

## Deploy

```bash
flyctl deploy --remote-only
```

App: `teller-api` · region: `ams` · 1 GB persistent volume `teller_state` mounted at `/app/state` (bunq session, sandbox key, enrichments). Secrets are managed via `flyctl secrets set`.
