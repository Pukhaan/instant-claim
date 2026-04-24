# Instant Claim

Multimodal AI insurance claims, built on bunq.

> Snap a photo of the damage. Say what happened. Money arrives in your bunq account in under 30 seconds.

Built for **bunq Hackathon 7.0** — theme: *Multimodal AI: Reinvent Banking*.

## What it does

bunq already offers travel and device insurance in its premium plans. Today, claims are processed by humans over days. **Instant Claim** replaces that flow with a multimodal AI pipeline:

1. User uploads a photo of the damage (cracked screen, flight delay notice).
2. User records a short voice note explaining what happened.
3. Claude Vision analyzes the photo; Whisper transcribes the voice note.
4. Claude extracts structured facts (amount, date, delay hours, …).
5. A simple rules engine decides: **APPROVE**, **REJECT**, or **ESCALATE**.
6. If approved, we call the **bunq sandbox API** to send an instant payout.

Supported claim types in the prototype: **broken device screen** and **flight delay**.

## Getting started

```bash
# 1. Install
npm install

# 2. Configure
cp .env.local.example .env.local
# fill in ANTHROPIC_API_KEY, OPENAI_API_KEY, BUNQ_API_KEY

# 3. Run
npm run dev
# → http://localhost:3000
```

## Environment variables

See [`.env.local.example`](./.env.local.example). Required:

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude Vision + reasoning (`claude-sonnet-4-6`) |
| `OPENAI_API_KEY` | Whisper speech-to-text |
| `BUNQ_API_KEY` | bunq sandbox key — issues the instant payout |
| `BUNQ_ENV` | `sandbox` (default) or `production` |
| `BUNQ_MONETARY_ACCOUNT_ID` | Optional; auto-resolved if omitted |

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full pipeline, file layout, and how the team should split work.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + **Framer Motion** for the UI
- **Anthropic Claude** (vision + JSON-structured reasoning)
- **OpenAI Whisper** (speech-to-text)
- **bunq sandbox REST API** (direct HTTP, no SDK)
- Deploy target: **Vercel**

## Demo script

1. Open the web app on a phone.
2. Tap *I have a claim* → pick *Broken screen*.
3. Snap a photo of a cracked phone. Hit record, say: *"I dropped my phone this morning, the screen is cracked, it'll cost me €180 to fix."*
4. Hit submit. Within ~15 seconds: ✅ **Approved. €180 sent to your bunq account.**
5. Switch to the bunq sandbox app — the balance updated.
