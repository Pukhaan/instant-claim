# bunq Hackathon — Attack Plan

**Date:** 2026-04-24
**Hackathon weights:** Innovation 25% · Impact 30% · Technical Execution 20% · bunq Integration 15% · (10% unallocated — assume Presentation/Demo)
**Team stack picks:** Anthropic Claude (direct API) + AWS (Transcribe / Polly / S3 / Lambda) + bunq Public API via `bunq_sdk` (sandbox) + Python FastAPI backend + Next.js 16 / Tailwind / shadcn / Vercel AI SDK frontend

---

## 1. The product in one line

> **Teller** — a multi-modal bunq co-pilot that doesn't just talk about your money. It **hears, sees, and acts.** Voice to invest a bonus. Camera to categorize a receipt. Proactive nudges before a bad financial choice hits your account.

(Working name: **Teller**. Short, banking-native, memorable, not a Finn clone. Alternates: **Pocket**, **Ledger**, **Cue**.)

---

## 2. Why this wins each criterion

| Criterion | Weight | How we win |
|---|---|---|
| **Innovation & Creativity** | 25% | Most hackathon entries will be "bunq chatbots". Ours is **action-first, not response-first**: every demo moment ends with money actually moving. Multi-modal inputs (voice + image + proactive trigger) aren't gimmicks — each one unlocks a different job-to-be-done. |
| **Impact & Usefulness** | 30% | Three jobs every bunq user has today: "split my income", "track spending", "don't let me overspend". We collapse them from 6–10 taps into a single spoken sentence or a photo. That's not a demo — that's a feature people actually use. |
| **Technical Execution** | 20% | Claude Sonnet with **tool use** drives a real agent loop over bunq's API. AWS Transcribe streams audio. Claude Vision parses receipts. Scheduled Lambda runs the "proactive guardian". Demo-bulletproof: sandbox bunq account + deterministic fixtures. |
| **bunq Integration** | 15% | We call the real bunq API for every action: `draft-payment`, `request-inquiry`, `monetary-account`, `savings-account`, `spending-limit`. Output respects bunq's own abstractions (sub-accounts, Auto Round Up, Organize Your Income). Feels like an extension of the app, not an overlay. |

---

## 3. The three killer demos (the whole pitch)

Each demo is ~40 seconds. All three together = one 2-minute narrative.

### Demo 1 — Hear: "Invest my bonus"

**Input:** microphone
**User says:** *"Hey Teller, my €500 bonus just landed. Invest most of it, but leave me a night out."*

**What happens on screen:**
1. Live transcript streams in (AWS Transcribe).
2. Claude pulls recent transactions via bunq API, finds the €500 incoming payment labeled "BONUS".
3. Proposes a split: €300 → Savings (Emergency), €150 → Stocks sub-account, €50 → Fun Money.
4. User says "do it". Claude calls `POST /draft-payment` three times. bunq confirms in-app.
5. Teller speaks back via AWS Polly: *"Done. €300 in Emergency, €150 earmarked for stocks, €50 for tonight."*

**Why it slaps:** one sentence → three coordinated bunq API calls → real money moved.

### Demo 2 — See: Receipt photo → auto-categorize

**Input:** camera / image upload
**User does:** snaps a photo of a Albert Heijn receipt.

**What happens on screen:**
1. Photo uploads to S3 (signed URL).
2. Claude Vision extracts merchant, total, line items.
3. Agent searches bunq transactions in last 72h for a matching amount/merchant (fuzzy match).
4. Agent **updates the transaction's description** via bunq API and, if configured, moves the exact amount from the "Groceries" sub-account to zero out the category.
5. UI shows before/after: "Unknown €23.47" → "Groceries · Albert Heijn · 12 items".

**Why it slaps:** solves the single most annoying thing about every banking app — category hygiene — in one tap.

### Demo 3 — Intervene: Proactive guardian

**Input:** no user input. It runs on its own.
**Trigger:** Lambda cron every 5 min reads recent transactions + spending limits.

**What happens on screen (push notification style):**
> *"Heads up. You've spent 87% of Dining this month, and your calendar says dinner at Le Restaurant tomorrow (~€80). Want me to (A) move €80 from Fun Money, (B) cap Dining for the week, or (C) ignore?"*

User taps A. Claude calls `draft-payment` from Fun Money sub-account → Dining sub-account. Done.

**Why it slaps:** this is the only one that requires zero user initiation. It's the agent behaving like a CFO, not a chatbot. Judges will remember it.

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND — Next.js 16 (App Router) on Vercel                 │
│  ├─ /chat     (streaming UI via Vercel AI SDK)                │
│  ├─ /voice    (AWS Transcribe streaming via WebSocket)        │
│  ├─ /receipt  (camera + S3 presigned upload)                  │
│  └─ /guardian (SSE feed for proactive nudges)                 │
└──────────────────────────────────────────────────────────────┘
                     │ HTTP/SSE
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND — Python 3.12 + FastAPI (Uvicorn)                    │
│  ├─ /api/chat        (Claude agent loop + bunq tools)         │
│  ├─ /api/receipt     (Claude Vision → match → categorize)     │
│  ├─ /api/voice       (transcript → agent → TTS audio url)     │
│  └─ /api/guardian/*  (state for the cron + SSE fan-out)       │
└──────────────────────────────────────────────────────────────┘
          │                        │                       │
          ▼                        ▼                       ▼
┌─────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ Anthropic API       │   │ AWS                 │   │ bunq Public API     │
│ Claude Sonnet 4.x   │   │ ├─ Transcribe (STT) │   │ via `bunq_sdk`      │
│ ├─ Tool use (bunq)  │   │ ├─ Polly (TTS)      │   │ (Python, official)  │
│ ├─ Vision (receipts)│   │ ├─ S3 (receipts)    │   │ Handles signing,    │
│ └─ Agent loop       │   │ └─ Lambda + EB cron │   │ session, refresh.   │
└─────────────────────┘   └────────────────────┘   └────────────────────┘
```

**Tools exposed to Claude** (thin Python wrappers around `bunq_sdk`):

- `list_accounts` / `get_balance` / `list_savings`
- `list_transactions(since, account_id)`
- `create_draft_payment(from, to, amount, description)` — the action verb
- `create_request_inquiry`
- `update_transaction_description(payment_id, text)` — for categorization
- `list_scheduled_payments` — for the guardian
- `get_spending_limits` (if exposed on sandbox)

### Why these picks

- **Split stack: Python backend, Next.js frontend.** The bunq team ships an **official hackathon toolkit** (see `/hackathon_toolkit`) with a 250-line `BunqClient` that handles the three-step auth, RSA request signing, and context caching. Writing that in TS is a 4–6h distraction. Python wins here. The Next.js user rule applies to the web app; the API is a separate service.
- **Use the toolkit's `BunqClient`, not `bunq_sdk`.** The official Python SDK is bigger, heavier, and uses a different abstraction. The toolkit client is purpose-built for this hackathon — we copy it into `/api/app/bunq_client.py` with attribution.
- **Guardian uses webhooks, not polling.** The toolkit's Tutorial 07 shows `/notification-filter-url` — bunq pushes payment/mutation events to our callback URL in real time. Near-zero latency for the proactive nudge, zero wasted API quota.
- **Anthropic direct, not Bedrock.** Bedrock adds 1–2h of IAM setup. Direct API is 10 minutes. We still use AWS for the parts where it's genuinely best (Transcribe, Polly, S3, Lambda). Judges get genuine **AWS + Anthropic**, not lip service.
- **Next.js + Vercel** for the frontend. Fastest path to a shareable live demo URL.
- **Backend hosting:** Fly.io or Render for the FastAPI service (free tier, one-command deploy, supports SSE cleanly). Vercel Python serverless is viable but its 10s timeout will fight the Claude agent loop. Avoid.
- **Claude tool use, not LangChain.** We write a thin agent loop in ~80 lines of Python. Judges reviewing code will see clean, readable logic.
- **bunq sandbox.** Real API. Real draft-payments. No mocks except the "bonus" that triggers Demo 1 (we seed it via Sugar Daddy beforehand).

---

## 5. 24-hour hackathon schedule (if this is a 24h hack)

| Hour | Task | Owner |
|---|---|---|
| 0–1 | Repo scaffold (monorepo: `/web` Next.js + `/api` FastAPI), `.env.example`, deploy hello-world to Vercel + Fly.io. Install `bunq_sdk`. Run bunq Postman collection end-to-end to verify sandbox auth. | Dev 1 |
| 0–1 | AWS account check: S3 bucket, IAM for Transcribe/Polly/Lambda. Anthropic API key smoke test from Python. | Dev 2 |
| 1–3 | **bunq tool layer (Python)**: wrap 7 SDK methods as typed Pydantic-validated functions. Unit-test each one against sandbox. | Dev 1 |
| 1–3 | **Chat UI**: Vercel AI SDK streaming chat → POSTs to FastAPI `/api/chat` which runs the Claude tool-use loop. | Dev 2 |
| 3–6 | **Demo 1 (Voice)**: Transcribe streaming → frontend sends transcript → Claude → bunq actions → Polly audio response. | Dev 1 |
| 3–6 | **Demo 2 (Receipt)**: S3 presigned upload → FastAPI pulls → Claude Vision → fuzzy-match transaction → `update_transaction_description`. | Dev 2 |
| 6–9 | **Demo 3 (Guardian)**: AWS Lambda (Python, same `bunq_sdk` code) on 5-min cron → evaluates rules → SSE push to Next.js. | Dev 1 |
| 6–9 | **Polish UI**: shadcn components, one accent color, text-balance, tabular-nums, three-panel demo layout. | Dev 2 |
| 9–12 | **Dogfood**: run all three demos end-to-end on sandbox data, fix flakiness | Both |
| 12–18 | **Buffer** for bugs + one surprise feature (see §7) | Both |
| 18–21 | **Record 3-min demo video**: script → shoot → edit | Both |
| 21–24 | **Pitch deck** (5 slides), README polish, final deploy | Both |

Single-person version: same sequence, halve the scope of Demo 3 to a cron that only warns (no action).

---

## 6. bunq API — the exact endpoints we'll use

### 6.1 Bootstrap (one-time, ~30 minutes)

This is where teams lose an afternoon. We'll have it running inside hour 1 because `bunq_sdk` does most of it for us.

1. **Create a sandbox user + API key** ([docs](https://doc.bunq.com/tutorials/your-first-payment/creating-a-sandbox-user-and-getting-an-api-key)):

   ```bash
   curl -X POST https://public-api.sandbox.bunq.com/v1/sandbox-user-person
   # → returns { "api_key": "sandbox_..." }
   ```

   Store in the backend `.env` as `BUNQ_API_KEY`. **Never commit.**

2. **Let the SDK handle the three-step bootstrap.** `bunq_sdk` generates the RSA keypair, calls `/installation`, `/device-server`, `/session-server`, caches the context to disk, and refreshes on expiry. The full bootstrap in Python is:

   ```python
   from bunq.sdk.context.api_context import ApiContext, ApiEnvironmentType

   ctx = ApiContext.create(
       ApiEnvironmentType.SANDBOX,
       os.environ["BUNQ_API_KEY"],
       "teller-hackathon",
       permitted_ips=["*"],
   )
   ctx.save("bunq-context.json")  # gitignored
   ```

   Compare that to hand-rolling all three HTTP calls + RSA key management in TS. No contest.

3. **Seed sandbox money.** Use the "Sugar Daddy" flow (request money from `sugardaddy@bunq.com`) to push €1000+ into the account so Demo 1 has a realistic "bonus".

4. **Shortcut: bunq's [Postman collection](https://github.com/bunq/postman)** for ad-hoc endpoint exploration and debugging. Keep it open in a side window during dev.

5. **Reference:** [`two-trick-pony-NL/hackathon6dot0`](https://github.com/two-trick-pony-NL/hackathon6dot0) shows the FastAPI + SDK + LLM-tool-calling glue. Read `main.py`, `ai_api_assistant.py`, and `functions.json` in 15 min.

### 6.2 The signing gotcha — handled for free

**`POST /payment` requires an RSA request signature in `X-Bunq-Client-Signature`** ([docs: signing](https://doc.bunq.com/basics/signing)). Historically this is where hackathon teams lose 4 hours.

`bunq_sdk` **does the signing transparently**, so in theory we could use `/payment` directly. We still **prefer `/draft-payment`** though, because:

- It shows up in the user's bunq app for confirmation → matches the "agent proposes, human approves" UX we want on stage.
- It's the more honest demo: the money visibly moves only after the user confirms in the real bunq app. Judges see both surfaces.
- If we want to flex that we can move real money without the app, we add **one** `/payment` call in Demo 1 as an end-beat. Stretch only.

### 6.3 Endpoints we'll actually call

- `POST /v1/installation`, `POST /v1/device-server`, `POST /v1/session-server` → session
- `GET  /v1/user/{userID}` → identity
- `GET  /v1/user/{userID}/monetary-account` → all sub-accounts (spending + savings)
- `GET  /v1/user/{userID}/monetary-account/{accountID}/payment` → transactions (read-only, no signing)
- `POST /v1/user/{userID}/monetary-account/{accountID}/draft-payment` → **the action verb** (no signing, confirmed in-app)
- `POST /v1/user/{userID}/monetary-account/{accountID}/request-inquiry` → request money
- `PUT  /v1/user/{userID}/monetary-account/{accountID}/payment/{paymentID}` → update description (categorization)
- `GET  /v1/user/{userID}/monetary-account/{accountID}/scheduled-payment` → for guardian

**Important constraint:** bunq's public API doesn't let you directly **buy stocks** from outside the app. "Invest" in Demo 1 = move to a dedicated **Stocks savings sub-account** with a clear label. We show intent + action; we don't fake a brokerage call. That's the honest move and judges will respect it.

---

## 7. Stretch features (if we have buffer time)

Rank by `impact / effort`:

1. **Natural-language rules.** *"If I spend more than €200 on Dining this month, auto-move the overage from Fun Money the next day."* → stored rule evaluated by the guardian Lambda. 3h.
2. **Video demo: scan an ATM screen.** Phone camera reads an ATM withdrawal amount and auto-logs the cash as "Cash Wallet". Uses Claude Vision on a live video frame. 2h.
3. **"Why" mode.** Any agent action is explainable. User taps a nudge → sees the reasoning trace (which transactions, which limits, which rule fired). Huge trust signal. 2h.
4. **Bunq Together.** Joint account aware — agent suggests splitting a shared receipt between partners via `request-inquiry`. 3h.

Don't do more than one stretch. Demo polish beats scope.

---

## 8. Risks & how we kill them

| Risk | Mitigation |
|---|---|
| bunq sandbox is flaky | Seed a fresh sandbox user at hour 0; keep a local JSON fixture fallback for the demo video |
| Request signing eats a half-day | Use `/draft-payment` (no signing) for all demo actions. Only touch `/payment` (signing required) as a stretch after hour 18. |
| Session-token bootstrap eats 3 hours | Validate every call in the bunq Postman collection **before** writing TS. Borrow the installation+device-server+session-server flow from `two-trick-pony-NL/PSD2-Implementation-for-bunq-API` as reference, not dependency. |
| Claude hallucinates the wrong account | Every `draft-payment` call requires explicit user confirmation in the UI before firing; show the exact payload |
| Voice demo fails on stage | Pre-record a fallback audio clip; have a "type instead" button as a visible affordance |
| Receipt OCR misses | Manual correction field stays visible; we optimize for the 80% case, not perfection |
| Judges ask "is this secure?" | Answer ready: OAuth-scoped, no credentials stored, draft-payment requires bunq-side confirmation, all actions auditable. Don't dodge — lean in. |

---

## 9. Demo script (2 minutes, verbatim)

> *"Banking apps listen. bunq-the-app already does a great job at that. But what if your bank could **act**?*
>
> *Watch. [Demo 1] I just got paid a bonus. I say, 'invest most of it, leave me a night out', and Teller — running on Claude and bunq — splits it across three of my accounts in three seconds.*
>
> *[Demo 2] This morning I bought groceries. I take a photo. Teller reads the receipt, finds the matching transaction, and categorizes it for me. No more 'Unknown' in my spending tab.*
>
> *[Demo 3] And while I'm doing all this, it's watching. I have a dinner booked tomorrow that would blow my Dining budget. Teller already saw it. It's asking me right now whether to move money, cap the budget, or ignore.*
>
> *One app. Voice, image, and proactive intelligence — all talking to the real bunq API. That's Teller."*

---

## 10. Open decisions (need a call before we start)

1. **Backend: Python FastAPI + `bunq_sdk` (recommended) or pure TS Next.js?** → Python saves 4–6h on signing/session code. The user rule "always use Next.js" still applies to the web app; the backend is a separate service.
2. **Direct Anthropic API or AWS Bedrock for Claude?** → Recommend **direct**. Faster, and we still get genuine AWS integration via Transcribe/Polly/S3/Lambda.
3. **Voice: streaming (AWS Transcribe) or push-to-talk (Whisper)?** → Recommend **Transcribe streaming** — it looks better on video.
4. **Scope of the guardian Lambda?** → For 24h: cron every 5 min, warn only. For 48h: scheduled actions too.
5. **Mobile-first PWA or desktop demo?** → Recommend **desktop demo** with a phone-shaped viewport. Easier to record, same visual story.
6. **Backend host: Fly.io (recommended) / Render / Railway / AWS Lambda?** → Fly for dev speed + SSE support.
7. **One accent color** — recommend bunq's green (`#00E676`ish) as an homage, our own background/typography.

Ship it.
