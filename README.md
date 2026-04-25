# Instant Claim

**An AI-native insurance assistant inside bunq.**
Tap "Start a Claim". Snap a photo. Speak 20 seconds. Get paid — usually before you've left the coffee shop.

> 🟢 Live demo: **<https://teller-eight.vercel.app>**
> 📦 Code:      **<https://github.com/andreaskruszakin/instant-claim>** (private)

[![Built for bunq AI Agents Hackathon](https://img.shields.io/badge/built%20for-bunq%20AI%20Agents%20Hackathon-orange)](https://doc.bunq.com)
[![AWS only](https://img.shields.io/badge/inference-AWS%20Bedrock-orange)](https://aws.amazon.com/bedrock/)
[![Multi-modal](https://img.shields.io/badge/modalities-image%20%C2%B7%20audio%20%C2%B7%20text-blue)](#multi-modal-throughout)

---

## The problem

Insurance claims today are a paperwork tax on people who already had a bad day. The damage is small enough that it should be a one-tap experience, but the process makes it feel like applying for a mortgage. Customers give up; banks pay the human cost; bunq's promise of a frictionless mobile bank stops at the boundary of "and now please fill out this PDF."

Most low-value claims (cracked screens, delayed flights, lost luggage) are decidable in seconds **if you have the right inputs**:

1. **Visual evidence** of the damage.
2. **The customer's own words**, naturally — when, where, how.
3. **Proof the item was bought**, ideally already in the bank's transaction history.
4. **The applicable policy clause.**

Banks already have #3 and #4. The customer has #1 and #2 in their pocket. The gap is purely *workflow* — and AI is finally good enough to close it.

## The solution

**Instant Claim** is the front door for the bunq travel + device insurance product, rebuilt as a 60-second conversational flow with **Finn**, a multi-modal assistant. The user's job is to point a camera and talk like a friend; everything else is automated:

| Step | What the user does | What the AI does |
|------|--------------------|------------------|
| 1 | Tap **Start a Claim** in their bunq home | — |
| 2 | Pick a category (Device, Travel, Medical, Luggage, Other) | — |
| 3 | Snap a photo with the native camera | **Claude Vision** classifies the photo (damage / receipt / other), labels the subject ("cracked iPhone screen") in real time |
| 4 | Speak ~20 seconds describing what happened | **AWS Transcribe Streaming** returns a transcript in ~3 seconds end-to-end |
| 5 | Glance at "here's what I heard" | — |
| 6 | Wait ~6 seconds | **Claude Sonnet 4.5 (Bedrock)** ingests the photo, the transcript, the user's last 30 bunq transactions and the policy clause; emits a structured decision via forced tool-use |
| 7 | See the verdict | Approve → instant payout queued · Escalate → human picks up · Reject → reason explained |

The customer's only inputs are **a glance and a sentence**. The bank's only output is **money in their account in seconds, or a sentence explaining why not**.

---

## Why AI is *core*, not bolted on

This isn't a chatbot pasted onto a form. The AI is the system — without it, there is no product. Four AI calls run on every claim:

| AI service | Modality | What it decides |
|------------|----------|-----------------|
| **Claude Vision (Bedrock)** · classify | Image | Is this a damage photo, a receipt, or something else? What is the subject? Drives the dynamic damage pill on the Review screen. |
| **AWS Transcribe Streaming** | Audio | Real-time speech → text via HTTP/2 streaming. ~3s warm-state vs ~17s on the legacy batch path. ffmpeg transcodes webm/opus → 16 kHz PCM in-process. |
| **Claude Sonnet 4.5 (Bedrock)** · vision + decision | Image + text | Inspects the damage photo, reads the transcript, scans 30 recent bunq transactions for matching purchases, applies the policy clause, and emits a structured `record_claim_decision` tool call (decision · payout_eur · damage_type · severity · matched_payment_id · reason). One inference call, one source of truth. |
| **Claude Sonnet 4.5 (Bedrock)** · agent loop | Text | The `/chat` agent at `/chat` — multi-turn tool use over the bunq API for "what did I spend on this week?" / "top up €500 from Sugar Daddy" / proactive financial nudges. |

Take any one of these out and the demo collapses. That's the bar for "AI as a core component."

## Multi-modal throughout

Every claim involves **all three** non-text modalities working together — they aren't decorative:

- 📷 **Image** — the damage photo (vision classification + final triage).
- 🎤 **Audio** — the voice note (live waveform during recording, then Transcribe Streaming).
- 📝 **Text** — the LLM glue (transcript + policy + transaction context → structured decision).

The decision itself fuses signal from all three: cracked-iPhone photo *and* "I dropped it walking out of the coffee shop" *and* the matching €1,249 Fonq Electronics purchase from 12 days ago all need to align before approval. Mismatch in any modality → escalate to a human, with the conflict explained.

---

## Demo walkthrough (2 minutes)

Open **<https://teller-eight.vercel.app>** on a phone (works great on iPhone Safari, "Add to Home Screen" gives it native chrome).

1. **Home** — bunq-style dashboard. Live balance from a seeded sandbox account (€20K → €9,770 after some merchant payments). Recent transactions are real bunq sandbox payments to Fonq, Apple Store, Sony, KLM, Vapiano, etc. Tap **Add Money** to top up €500 from Sugar Daddy and watch the balance refresh.
2. **Tap "Start a Claim"** in the *Your Travel* card. Wizard takes over the screen.
3. **Introduction** — Finn explains the three steps. Tap *Pick category*.
4. **Category** — pick Device Damage, tap *Continue to camera*.
5. **Camera** opens natively. Photograph a cracked phone (or use any photo with damage).
6. **Review Photo** — the red pill in the corner is dynamic. It shows `analyzing…` for ~1.5s, then the AI's actual finding: e.g. `iphone — cracked iphone screen`. Hit *Record voice note*.
7. **Voice Note** — tap the red record button. Live waveform pulses. Say something like *"I dropped my iPhone walking out of a coffee shop and the screen cracked, repair quote was 120 euros."* Tap *Done — send to Finn*.
8. **"Sound right?"** — your transcript, in your own words. Re-record link if it caught you wrong. Otherwise *Sounds right — analyze*.
9. **Finn is working** — Reading your photo · Listening to your note · Matching your purchase (this one finds the iPhone in your bunq history) · Sending to Quovo · Confirming policy · Calculating payout. Six checks, ~6s on warm state.
10. **Payout Confirmed!** — *€95.00* approved, €25 deductible already applied. Claim ID, item, policy. Tap *Back to Homepage*.

**Now try the unhappy path.** Repeat from step 4 but say *"my iPad got cracked"* in the voice note. There's no iPad in your bunq history — Finn escalates with: *"I can see your cracked screen and the damage looks covered, but I don't see an iPad purchase on your bunq account yet — let me loop in a human to help sort this out."* No reject; a human picks it up. That's the bar for "graceful, conservative, human-feeling AI" rather than gotcha behaviour.

---

## bunq integration

This is *inside the bank*, not next to it.

- **Authenticated via the official bunq hackathon toolkit** — installation → device-server → session-server, RSA request signing — so the prototype talks to the real `api-sandbox.bunq.com` endpoints, not a mock.
- **Live balance + transaction reads.** The home screen pulls `/monetary-account-bank` and `/payment` on every render.
- **Transaction-grounded decisions.** The claim triage loop is given the user's last 30 payments and is instructed to escalate when the claimed item has no plausible purchase. That's the bunq-specific superpower the product wraps.
- **Sugar Daddy faucet wired to *Add Money*.** A `POST /request-inquiry` call lets the demo refill the sandbox in one tap.
- **Idempotent seeded data.** `POST /sandbox/seed` (run on first boot) tops up to ~€20K and emits 10 realistic outgoing payments (iPhone · Fonq, MacBook · Apple, Sony WH-1000XM5, KLM, Vapiano, bol.com, Albert Heijn, Uber, Starbucks) so the matching logic has something to find.
- **No bunq data leaves bunq's API perimeter** other than to AWS Bedrock + Transcribe in `us-east-1`, which is the stated workshop AWS region.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          USER (iPhone Safari)                            │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                              same-origin /api/*
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Next.js 16 frontend  ·  Vercel  ·  teller-eight.vercel.app              │
│  ─────────────────────────────────────────────────────────────────────── │
│   /          bunq-style home (server component, live data)               │
│   /claim     Finn wizard (8 stages, framer-motion screen transitions)    │
│   /chat      Multi-turn Claude tool-use agent over the bunq API          │
│   /api/[…]   Catch-all proxy → FastAPI (no CORS, no client secrets)      │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                              HTTPS, single origin
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  FastAPI backend  ·  Fly.io (ams)  ·  teller-api.fly.dev                 │
│  ─────────────────────────────────────────────────────────────────────── │
│   POST /claim            full multi-modal triage pipeline                │
│   POST /transcribe       Transcribe Streaming via ffmpeg+SDK             │
│   POST /classify-photo   Claude Vision (kind / subject / summary)        │
│   POST /chat             SSE-streamed Claude tool-use agent              │
│   POST /sandbox/seed     idempotent €20K + merchant payment seed         │
│   POST /sandbox/topup    Sugar Daddy faucet                              │
│   GET  /accounts, /accounts/{id}/transactions, /health, /aws/probe       │
└──────────────────────────────────────────────────────────────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────┐     ┌────────────────────┐     ┌─────────────────┐
│ bunq sandbox │     │ AWS Bedrock        │     │ AWS Transcribe  │
│ api-sandbox  │     │ Claude Sonnet 4.5  │     │ Streaming       │
│ .bunq.com    │     │ (vision + LLM)     │     │ + Polly + S3    │
└──────────────┘     └────────────────────┘     └─────────────────┘
```

Single source of LLM truth: `api/app/llm.py` exposes `claude()` + `model()`. All four call sites (`agent.py`, `claims.py`, `receipts.py`, `photo_classify.py`) go through it. Defaulting to **AWS Bedrock** in `us-east-1`; a `USE_BEDROCK=false` flag flips back to direct Anthropic API for local dev when AWS session creds expire.

## Repo layout

```
/
├── README.md            ← you are here
├── HANDOFF.md           ← quick get-started for collaborators (one-time clones)
├── AGENTS.md            ← long-running agent rules (Cursor / Claude Code)
├── docs/
│   ├── PLAN.md          ← original 24h attack plan, mapped to judging criteria
│   ├── CHANGELOG.md     ← reverse-chronological log of every change
│   └── DEPLOY.md        ← the prod deploy runbook
├── hackathon_toolkit/   ← official bunq toolkit (reference + runnable tutorials)
├── api/                 ← FastAPI backend
│   ├── app/
│   │   ├── main.py            FastAPI routes
│   │   ├── llm.py             single AnthropicBedrock client
│   │   ├── agent.py           chat agent + Claude tool-use loop
│   │   ├── claims.py          claim-triage pipeline (vision + LLM + bunq + policy)
│   │   ├── photo_classify.py  fast photo classification
│   │   ├── receipts.py        receipt vision + bunq match
│   │   ├── transcribe.py      AWS Transcribe Streaming + batch fallback
│   │   ├── seed.py            sandbox seed (€20K + 10 merchant payments)
│   │   ├── bunq_client.py     RSA-signed bunq HTTP client (toolkit-derived)
│   │   └── bunq_service.py    typed high-level bunq ops
│   ├── Dockerfile             Python 3.13 + ffmpeg
│   ├── fly.toml               Fly app config (ams, persistent volume)
│   └── requirements.txt
└── web/                 ← Next.js 16 frontend
    ├── app/
    │   ├── page.tsx           bunq home (server component, server actions)
    │   ├── claim/             Finn wizard (8 stages)
    │   ├── chat/              chat-first interface
    │   ├── api/[...path]/     same-origin proxy → FastAPI
    │   └── balance-chip.tsx   live-balance pill on /chat header
    ├── public/
    │   ├── Avatar.png         user portrait + bunq Elite badge
    │   ├── AI_Logo.png        rainbow-ringed Finn logo
    │   ├── bunq-logo.png
    │   └── finn/              4 Finn avatars (neutral · happy · thinking · celebrate)
    └── lib/                   typed clients for /transcribe, /classify-photo, /claim
```

---

## Run it locally

Two terminals.

### Backend

```bash
cd api
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in:
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN, AWS_REGION
#   ANTHROPIC_API_KEY (optional fallback)
#   BUNQ_API_KEY=  (leave empty — first run creates a sandbox user)
uvicorn app.main:app --reload --port 8000
```

First boot authenticates with bunq sandbox and caches the session at `bunq_context.json`. Then seed it:

```bash
curl -X POST http://localhost:8000/sandbox/seed | jq
```

For Transcribe Streaming, you also need `ffmpeg` on PATH (`brew install ffmpeg` on macOS). Without it, the path falls back to AWS Transcribe batch — slower (~17s vs ~3s) but still functional.

### Frontend

```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>.

---

## Deploy

- **Frontend → Vercel:** `cd web && vercel deploy --prod --yes && vercel alias set <new-url> teller-eight.vercel.app`
- **Backend → Fly.io:** `cd api && flyctl deploy --remote-only`

Secrets are set with `flyctl secrets set NAME=value` (Fly) and via the Vercel dashboard / `vercel env add` (frontend). The frontend only needs `API_BASE_URL=https://teller-api.fly.dev`.

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend framework | **Next.js 16 (App Router)** on Vercel | Server Components for live bunq data on the home page, server actions for *Add Money*, single-origin `/api/[...path]` proxy keeps secrets out of the client. |
| Styling | **Tailwind CSS 4** | iOS-native dark theme + Finn-Insurance design system (`--finn-*` tokens, custom typography scale). |
| Animation | **framer-motion** | Wizard screen-to-screen transitions; live audio waveform. |
| LLM | **Anthropic Claude Sonnet 4.5** via **AWS Bedrock** (`us.anthropic.claude-sonnet-4-5-20250929-v1:0`) | Top-tier vision + structured tool-use; `AnthropicBedrock` client makes the SDK identical to direct Anthropic. |
| Speech-to-text | **AWS Transcribe Streaming** (HTTP/2) | Sub-3s warm transcription. ffmpeg in-process transcode keeps the frontend's MediaRecorder API unchanged. |
| Text-to-speech | **AWS Polly** (wired, not yet user-facing) | For the future Guardian feature where Finn reads alerts aloud. |
| Storage | **AWS S3** | Receipt + audio object store (auto-provisioned bucket, 7-day lifecycle). |
| Backend | **FastAPI · Python 3.13** on Fly.io (`ams`) | Native async, low cold start, persistent volume for bunq session state. |
| Bank | **bunq sandbox API** | Real auth, real transactions, real payments. |
| Workshop creds | AWS STS session creds | Mirrored into `os.environ` at call time so `awscrt`'s credential resolver picks them up. |

---

## How this maps to the judging criteria

| Criterion | Weight | Where it shows up |
|-----------|--------|-------------------|
| **Innovation & Creativity** | 25% | Multi-modal claim triage in <10s. Photo classification *during* photo review. Transaction history as the source of truth that *prevents* fraud rather than just enabling approval. The "loop in a human" escalate pattern, with conflict explanations rather than reject. |
| **Impact & Usefulness** | 30% | Insurance claims are the most-cited friction in retail banking customer surveys. The bunq travel + device insurance is real product. This flow turns the worst customer experience (paperwork after damage) into the best (60 seconds, money on the way). |
| **Technical Execution** | 20% | All four AI surfaces in production, end-to-end. Streaming transcription with batch fallback. Forced tool-use for structured decisions. Live bunq data via authenticated RSA-signed sessions. CI-clean monorepo, typed everywhere. |
| **bunq Integration** | 15% | Authenticated via the official toolkit, not a mock. Real `/payment`, `/request-inquiry`, `/monetary-account-bank` calls. UI mirrors the bunq doc-site visual language; flow lives where insurance lives in the bunq app. |

---

## Built by

**Andreas Kruszakin-Liboska** ([@andreaskruszakin](https://github.com/andreaskruszakin)), **David Pukha** ([@Pukhaan](https://github.com/Pukhaan)), and **Valeriu Ilicciev** ([@Valeriu01](https://github.com/Valeriu01)) for the **bunq AI Agents Hackathon** (April 2026).

`api/app/bunq_client.py` adapted from the official [bunq hackathon toolkit](hackathon_toolkit/) (attribution in the file header). All Finn avatars and design language come from the team's *Finn-Insurance* Figma file.
