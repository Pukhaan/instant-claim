# Finn — Multimodal AI Claims Assistant for bunq

**Insurance claims should be one tap, not two weeks.**
Finn lives natively inside the bunq app and replaces the entire third-party claim flow with a 60-second multimodal conversation: a photo, a voice note, and an instant payout to the user's main account.

> 🟢 Live demo: **<https://teller-eight.vercel.app>**
> 📦 Code:      **<https://github.com/Pukhaan/instant-claim>** (private)

[![Built for bunq AI Agents Hackathon](https://img.shields.io/badge/built%20for-bunq%20AI%20Agents%20Hackathon-orange)](https://doc.bunq.com)
[![AWS only](https://img.shields.io/badge/inference-AWS%20Bedrock-orange)](https://aws.amazon.com/bedrock/)
[![Multi-modal](https://img.shields.io/badge/modalities-image%20%C2%B7%20audio%20%C2%B7%20text-blue)](#how-non-text-modality-is-integrated)

---

## The problem we're solving

bunq's elite subscription tier bundle real insurance products that are one of the primary reasons users upgrade and stay subscribed to it. However, the insurance is underwritten by **Quvos**, which is a third-party partner. This split is what drives churn in bunq's most profitable subscription line.

The moment a user actually needs to claim, they are pushed out of the bunq app and ecosystem entirely, onto a third-party portal with a fourteen-field form, asked to re-enter data bunq already holds. Plus they are made to wait 7–14 days for a decision. Industry data puts claim-handling cost at **€30–80 per ticket** and utilization on bundled insurance **below 15%** — meaning the vast majority of elite subscribers pay every month for a benefit they don't get the benefit of, because of how badly designed the system is.

The downstream effect is exactly what bunq's retention numbers reflect: **collapsing perceived value of the premium plan, falling satisfaction, falling NPS, and increased churn from the highest-paying tier**. At the exact moment a user most needs their bank, bunq is nowhere to be found. The users are sent on someone else's website.

## Return on investment — concentrated on retention

This is, above all, a churn and retention problem, and Finn addresses it directly. At conservative assumptions and based on bunq's public scale and standard industry benchmarks, the annual upside is in the **€15–20 million range**:

- **Premium-tier churn reduction is the headline.** Finn makes the bundled insurance finally usable. Utilization moves from industry-average single digits toward double digits. Satisfaction rises. NPS rises. Users feel the value of what they are paying for and stop downgrading. **A single percentage point of premium-tier retention recovered is in the multi-million-euro range of preserved ARR every year** — and this is the lever that compounds most over time.
- **Faster, easier UX is the mechanism.** Claim time collapses from days to under a minute. No forms. No typing. No third-party portal. A photo and a voice note replace every manual step.
- **The user never leaves the bunq ecosystem.** The most stressful financial moment of their year happens natively in bunq — which is precisely where deep loyalty, trust, and retention are earned.
- **Operational cost savings of €1–2M per year** as AI-assembled claims replace manual handling (industry cost per ticket €30–80 → Finn effectively €0).
- **Seven-figure commission gain.** Quvos receives cleaner, AI-pre-validated submissions, lifting approval rates and giving bunq real leverage to renegotiate the commission split.
- **Premium-plan attach uplift.** *"File your claim by talking to Finn"* becomes a top-of-funnel marketing line. Every 1% of additional premium conversions at bunq's scale is worth millions in new ARR.
- **Payback period: weeks, not years.** Implementation is a small engineering team sitting on top of bunq's existing APIs and Quvos's existing intake API.

## Our solution

Finn is a multimodal AI claim assistant that lives natively inside the bunq app and replaces the entire third-party claim flow. The user no longer fills out a form. They take a photo of what happened, record a short voice note describing it, and Finn does the rest — matching the incident to the underlying transaction in bunq history, confirming policy coverage, packaging a clean pre-validated claim, and submitting it to Quvos through Quvos's existing API.

For high-confidence low-amount claims, **bunq fronts an instant payout to the user's main account and reconciles with Quvos in the background**. Claim time drops from days to under a minute. The user never has to leave the bunq ecosystem at the most stressful financial moment of their year — and that is precisely where bunq earns the loyalty that drives retention and defends ARR.

| Step | What the user does | What Finn does |
|------|--------------------|----------------|
| 1 | Tap **Start a Claim** from the bunq home / Travel-Insurance card | — |
| 2 | Pick a category (Device, Travel, Medical, Luggage, Other) | — |
| 3 | Snap a photo with the native camera | **Claude Vision** classifies the photo, labels the subject ("cracked iPhone screen") in real time |
| 4 | Speak ~20 seconds — when, where, how | **AWS Transcribe Streaming** returns a transcript in ~3 seconds |
| 5 | Glance at *"here's what I heard"* and confirm | — |
| 6 | Wait ~6 seconds | **Claude Sonnet 4.5 (Bedrock)** fuses photo + transcript + 30 recent bunq transactions + Quvos policy clause; emits a structured decision via forced tool-use |
| 7 | See the verdict | Approve → bunq fronts payout, reconciles with Quvos · Escalate → human picks up · Reject → reason explained warmly |

The customer's only inputs are **a glance and a sentence**. The bank's only output is **money in their account in seconds, or a sentence explaining why not**.

---

## How AI is used

AI is the core of how Finn functions, not a wrapper over a traditional form. **Three model layers work together** — without them, the form-free, conversation-driven experience is impossible. Every step of automated claim assembly, validation, and submission depends on them.

| Layer | Model | What it does |
|-------|-------|--------------|
| **Vision** | Claude Sonnet 4.5 via **AWS Bedrock** | Analyzes the damage photo to identify the issue, locate it spatially, and validate that the evidence is usable. Drives the live damage pill on the Review screen ("cracked iPhone screen", "delay board · 4h"). |
| **Speech-to-text** | **AWS Transcribe Streaming** (HTTP/2) | Real-time transcription of the voice note. ffmpeg transcodes webm/opus → 16 kHz PCM in-process; final transcript back in ~3s warm-state vs ~17s on the legacy batch path. |
| **Reasoning** | Claude Sonnet 4.5 via **AWS Bedrock** + forced tool-use | Extracts structured facts from the transcript (when, where, how, severity, third parties), joins them against the user's bunq transaction history to verify the underlying covered purchase, cross-references the active Quvos policy for coverage rules, and outputs a confidence score plus a structured claim payload formatted for Quvos's intake API. |

A separate **Claude Sonnet 4.5 agent loop** at `/chat` handles multi-turn tool use over the bunq API for proactive nudges, balance queries, and money movement — same model, same Bedrock entry point, different system prompt.

Take any one of these layers out and the demo collapses. That's the bar for *"AI as a core component."*

## How non-text modality is integrated

Finn integrates **two non-text modalities as first-class inputs** that together replace the traditional claim form. Image and audio are not decoration on a form — they are the entire interface. That is how the UX becomes effortless, and how the claim stays inside bunq.

- 📷 **Image** — the user photographs the damaged device, delay board, medical bill, or luggage tag. Computer vision identifies the issue, surfaces a bounding box for confirmation, and validates evidence quality on the spot. Re-shoot is a single tap if the model is uncertain.
- 🎤 **Audio** — the user speaks freely about what happened. Live waveform during recording. Speech transcription plus LLM extraction turn natural language into structured claim data with no typing required.
- 📝 **Text** is the *LLM glue* — never asked of the user. Policy + transaction history + extracted facts → structured decision.

The triage itself fuses signal from all three: cracked-iPhone photo *and* "I dropped it walking out of the coffee shop" *and* the matching €1,249 Fonq Electronics purchase from 12 days ago all need to align before approval. Mismatch in any modality → escalate to a human, with the conflict explained.

---

## Demo walkthrough (2 minutes)

Open **<https://teller-eight.vercel.app>** on a phone (works great on iPhone Safari, "Add to Home Screen" gives it native chrome).

1. **Home** — bunq-style dashboard. Live balance from a seeded sandbox account (€20K → €9,770 after some merchant payments). Recent transactions are real bunq sandbox payments to Fonq, Apple Store, Sony, KLM, Vapiano, etc. Tap **Add Money** to top up €500 from Sugar Daddy and watch the balance refresh.
2. **Tap "Start a Claim"** in the *Your Travel* card. Wizard takes over the screen.
3. **Introduction** — Finn explains the three steps. Tap *Pick category*.
4. **Category** — pick Device Damage, tap *Continue to camera*.
5. **Camera** opens natively. Photograph **something that's actually broken** — a cracked phone screen, a smashed laptop lid, a dented iPad. The vision model is conservative on purpose: a clean undamaged item gets classified as `other`, the wizard won't proceed, and you'll just see Finn shrug. *(Out of breakable items? Google "cracked iPhone screen" and photograph your monitor.)*
6. **Review Photo** — the red pill in the corner is dynamic. It shows `analyzing…` for ~1.5s, then the AI's actual finding: e.g. `iphone — cracked iphone screen`. Hit *Record voice note*.
7. **Voice Note** — tap the red record button. Live waveform pulses. Say something like *"I dropped my iPhone walking out of a coffee shop and the screen cracked, repair quote was 120 euros."* Tap *Done — send to Finn*.
8. **"Sound right?"** — your transcript, in your own words. Re-record link if it caught you wrong. Otherwise *Sounds right — analyze*.
9. **Finn is working** — Reading your photo · Listening to your note · Matching your purchase (this one finds the iPhone in your bunq history) · Sending to Quovo · Confirming policy · Calculating payout. Six checks, ~6s on warm state.
10. **Payout Confirmed!** — *€95.00* approved, €25 deductible already applied. Claim ID, item, policy. Tap *Back to Homepage*.

**Now try the unhappy path.** Repeat from step 4 but say *"my iPad got cracked"* in the voice note. There's no iPad in your bunq history — Finn escalates with: *"I can see your cracked screen and the damage looks covered, but I don't see an iPad purchase on your bunq account yet — let me loop in a human to help sort this out."* No reject; a human picks it up. That's the bar for "graceful, conservative, human-feeling AI" rather than gotcha behaviour.

> **Testing tip for jurors:** the system is **end-to-end real**, not scripted. The vision model genuinely classifies what it sees and refuses to file a claim if you photograph something that isn't broken. The transaction matcher genuinely scans your last 30 bunq payments and escalates if the claimed item isn't there. So **always test with a photo of an actually-damaged item** — broken iPhone, cracked laptop screen, dented iPad — and **mention an item that's already in the seeded transactions** (iPhone, MacBook, Sony headphones, KLM flight). After a successful approve, the **`Quvos Insurance Payout`** transaction lands at the top of the home-screen recent-transactions list as a real bunq sandbox payment — that row only appears once a claim has actually been approved, never as demo dressing.

---

## bunq integration

Finn is designed to plug directly into bunq's existing surfaces. **It is launched from the home screen and the Travel/Insurance card.** It uses the bunq API to read transaction history for purchase verification and to push instant payouts. It submits claims to Quvos through their existing intake API, and surfaces the resulting status back inside the bunq app, so the user never leaves the ecosystem. **No part of the architecture requires bunq to change its underwriting partner or to rebuild the insurance product** — Finn sits cleanly on top of the systems that already exist and turns them into a single coherent in-app experience.

In this prototype:

- **Authenticated via the official bunq hackathon toolkit** — installation → device-server → session-server, RSA request signing — so the prototype talks to the real `api-sandbox.bunq.com` endpoints, not a mock.
- **Live balance + transaction reads.** The home screen pulls `/monetary-account-bank` and `/payment` on every render.
- **Transaction-grounded decisions.** The claim triage loop is given the user's last 30 payments and instructed to escalate when the claimed item has no plausible purchase — exactly the bunq-specific superpower the product wraps.
- **Sugar Daddy faucet wired to *Add Money*.** A `POST /request-inquiry` server action lets the demo refill the sandbox in one tap.
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
| **Impact & Usefulness** | 30% | Direct attack on the **€15–20M/year retention leak** in bunq's premium subscription line. The bundled Quvos insurance is real product, real ARR, real churn driver. This flow turns the single most stressful claim moment into the single strongest reason to stay subscribed. |
| **Technical Execution** | 20% | All four AI surfaces in production, end-to-end. Streaming transcription with batch fallback. Forced tool-use for structured decisions. Live bunq data via authenticated RSA-signed sessions. CI-clean monorepo, typed everywhere. |
| **bunq Integration** | 15% | Authenticated via the official toolkit, not a mock. Real `/payment`, `/request-inquiry`, `/monetary-account-bank` calls. UI mirrors the bunq doc-site visual language; flow lives where insurance lives in the bunq app. No change to the underwriting partner or product — Finn slots cleanly on top. |

---

## Why this matters

Finn takes the single moment most likely to drive a premium user to churn and turns it into the single moment most likely to make them stay for life. **It converts a multi-million-euro annual revenue leak into bunq's strongest premium-tier retention engine** — and it does it by keeping the user inside the bunq ecosystem, with a UX that is finally as fast, effortless, and satisfying as the rest of the bunq app.

---

## Built by

**Andreas Kruszakin-Liboska** ([@andreaskruszakin](https://github.com/andreaskruszakin)), **David Pukha** ([@Pukhaan](https://github.com/Pukhaan)), and **Valeriu Ilicciev** ([@Valeriu01](https://github.com/Valeriu01)) for the **bunq AI Agents Hackathon** (April 2026).

`api/app/bunq_client.py` adapted from the official [bunq hackathon toolkit](hackathon_toolkit/) (attribution in the file header). All Finn avatars and design language come from the team's *Finn-Insurance* Figma file.
