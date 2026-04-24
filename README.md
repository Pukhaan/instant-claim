# Teller — your bunq co-pilot

A multi-modal AI banker for bunq. Hear a voice command and invest a bonus. See a receipt and categorise it. Intervene proactively before a bad financial choice hits your account.

Built for the **bunq AI Agents hackathon** using Anthropic Claude, AWS (Transcribe / Polly / S3), and the official bunq hackathon toolkit.

> **Status:** hour 0–1 complete. Repo scaffolded, backend authenticates with the bunq sandbox, and the frontend renders live balance + transactions through an end-to-end proxy. See `docs/PLAN.md` for the 24h schedule.

## Repo layout

```
/
├── README.md               ← you are here
├── docs/
│   ├── PLAN.md             ← attack plan mapped to judging criteria
│   └── CHANGELOG.md        ← reverse-chron log of every change
├── hackathon_toolkit/      ← official bunq toolkit (reference + runnable tutorials)
├── api/                    ← FastAPI backend — bunq + Claude agent loop
└── web/                    ← Next.js 16 frontend — chat, voice, camera, dashboard
```

## Run it

Two terminals.

**Backend**

```bash
cd api
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

First run auto-creates a bunq sandbox user and caches the key in `.bunq_sandbox_key` (gitignored) so subsequent restarts reuse the same account.

**Frontend**

```bash
cd web
pnpm install
cp .env.local.example .env.local
pnpm dev
```

Open <http://localhost:3000>. You should see the dashboard with your sandbox account's IBAN, balance, and recent transactions. Click **Request €500** to seed it from Sugar Daddy.

## What's wired

- `/api/health` → authenticates the bunq client (installation → device → session), returns user info + config checks for Anthropic and AWS.
- `/api/accounts` → live `GET /monetary-account-bank`, filtered to ACTIVE, returned as a typed list.
- `/api/accounts/{id}/transactions` → live `GET /payment`, most-recent first.
- `/api/sandbox/topup` → `POST /request-inquiry` to `sugardaddy@bunq.com` for €500.
- Next.js `/api/[...path]` route → transparent proxy to the FastAPI backend. Frontend code only ever calls same-origin URLs.

## What's next

Following `docs/PLAN.md`:

1. **hour 1–3** — wrap the remaining bunq ops as tools, write the Claude tool-use loop, streaming chat endpoint.
2. **hour 3–6** — Demo 1 (voice → invest) and Demo 2 (receipt → categorise) in parallel.
3. **hour 6–9** — Demo 3 (guardian) via bunq webhooks + SSE push.

## Credits

- `api/app/bunq_client.py` adapted from the [bunq hackathon toolkit](hackathon_toolkit/). Attribution in file header.
