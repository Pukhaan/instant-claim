# Teller — API

FastAPI backend. Wraps the bunq hackathon toolkit, exposes typed tools to the Claude agent loop, and serves the frontend.

## First run

```bash
cd api
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# (leave BUNQ_API_KEY empty — first run will create a sandbox user)
uvicorn app.main:app --reload --port 8000
```

Then:

```bash
curl http://localhost:8000/health | jq
curl http://localhost:8000/accounts | jq
curl -X POST http://localhost:8000/sandbox/topup | jq
```

First call creates a sandbox user, authenticates (installation → device-server → session-server), caches the session in `bunq_context.json`.

## Layout

```
api/
├── app/
│   ├── main.py           ← FastAPI app + routes
│   ├── config.py         ← settings (pydantic-settings)
│   ├── bunq_client.py    ← low-level HTTP + RSA signing (from toolkit)
│   └── bunq_service.py   ← typed high-level ops for the agent
├── requirements.txt
└── .env.example
```

## Why copied, not imported

The toolkit's `bunq_client.py` lives under `/hackathon_toolkit/` as reference + runnable tutorials. A lightly edited copy lives here so our backend is self-contained and deployable without path hacks. Attribution is in the file header.
