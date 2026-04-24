# Architecture

> One-day hackathon build. Keep it tight. Ship a live demo, not a framework.

## The pitch, in one sentence

> **Photo + voice note → Claude decides in seconds → bunq sandbox pays out instantly.**

Every architectural decision below serves that one sentence.

## Pipeline

```
                ┌────────────────────── browser ──────────────────────┐
                │                                                     │
   [ photo ]  ──┤  ClaimForm                                          │
   [ audio ]  ──┤    └── POST /api/claim (multipart)                  │
                │                                                     │
                └─────────────────────────┬───────────────────────────┘
                                          │
                ┌─────────────────── Next.js server ──────────────────┐
                │                                                     │
                │   app/api/claim/route.ts                            │
                │       │                                             │
                │       ├─▶ lib/whisper.ts  transcribe(audio)         │
                │       │         │                                   │
                │       │         ▼                                   │
                │       │     transcript                              │
                │       │                                             │
                │       ├─▶ lib/claude.ts   analyzePhoto(img)         │
                │       │                   extractFacts(transcript)  │
                │       │         │                                   │
                │       │         ▼                                   │
                │       │     { analysis, facts }                     │
                │       │                                             │
                │       ├─▶ lib/rules.ts    decide(facts, analysis)   │
                │       │         │                                   │
                │       │         ▼                                   │
                │       │     APPROVED | REJECTED | ESCALATED         │
                │       │                                             │
                │       └─▶ lib/bunq.ts    payout(amount)  (if ✅)    │
                │                 │                                   │
                │                 ▼                                   │
                │           PayoutReceipt                             │
                │                                                     │
                └─────────────────────────┬───────────────────────────┘
                                          │
                                          ▼
                             ClaimResult (animated UI)
```

The whole round-trip target: **under 20 seconds** on a decent connection. Whisper is the slowest step (~3–6s for a 20s clip), Claude vision ~2–4s, bunq payment ~1s.

## File layout

```
instant-claim/
├── app/
│   ├── layout.tsx                ← root layout, global CSS
│   ├── page.tsx                  ← hosts ClaimForm → ClaimResult
│   ├── globals.css               ← Tailwind entry
│   └── api/claim/route.ts        ← the single backend endpoint
│
├── components/
│   ├── ClaimForm.tsx             ← photo + voice + claim type + submit
│   ├── ClaimResult.tsx           ← animated approve/reject/escalate screen
│   ├── PhotoUpload.tsx           ← camera/file input with preview
│   └── VoiceRecorder.tsx         ← MediaRecorder-based mic capture
│
├── lib/
│   ├── types.ts                  ← shared TS contracts (ClaimResult, etc.)
│   ├── claude.ts                 ← Claude vision + structured extraction
│   ├── whisper.ts                ← OpenAI Whisper wrapper
│   ├── bunq.ts                   ← bunq sandbox: install → session → payment
│   └── rules.ts                  ← hardcoded approve/reject/escalate logic
│
├── public/                       ← static assets (logo, demo images)
│
├── .env.local.example            ← template for secrets
├── README.md                     ← quickstart + demo script
├── ARCHITECTURE.md               ← this file
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── package.json
```

## Key contracts

All the interfaces live in [`lib/types.ts`](./lib/types.ts). The frontend and backend agree on one shape:

```ts
interface ClaimResult {
  decision: "APPROVED" | "REJECTED" | "ESCALATED";
  reason: string;
  amount: number | null;
  facts: ClaimFacts;           // structured from transcript
  analysis: DamageAnalysis;    // structured from photo
  payout: PayoutReceipt | null; // present iff APPROVED
}
```

If you change this shape, update both sides in the same commit.

## Decision rules (v1 — hardcoded)

From [`lib/rules.ts`](./lib/rules.ts):

| Claim type | Rule | Outcome |
| --- | --- | --- |
| `broken_screen` | photo confidence ≥ 0.6 **and** claimed ≤ €300 | ✅ APPROVE |
| `broken_screen` | claimed > €300 | ⏸ ESCALATE |
| `flight_delay` | photo confidence ≥ 0.6 **and** delay ≥ 3h | ✅ APPROVE (€250) |
| `flight_delay` | delay < 3h | ❌ REJECT |
| anything else / low confidence / missing facts | — | ⏸ ESCALATE |

Keep this file short and readable — judges will read it.

## bunq integration

The **15% of the score** we most want to nail. See [`lib/bunq.ts`](./lib/bunq.ts).

Sandbox flow on first request:

1. `POST /v1/installation` — installation token + server public key.
2. `POST /v1/device-server` — register this device with our API key.
3. `POST /v1/session-server` — open a user session → session token + `userId`.
4. `GET  /v1/user/{userId}/monetary-account` — pick an account to pay from.
5. `POST /v1/user/{userId}/monetary-account/{id}/payment` — send the payout.

Cache installation + session at module scope (single-process Next.js server is fine for the demo). Refresh on 401.

Docs: https://doc.bunq.com

## Team split (parallel tracks)

Everyone can start immediately. The contracts in `lib/types.ts` are the seams.

| Track | Owns | Ready to start on |
| --- | --- | --- |
| **Frontend A** | `components/ClaimForm.tsx`, `components/PhotoUpload.tsx`, `components/VoiceRecorder.tsx`, `app/page.tsx` | now — mock the POST with a static `ClaimResult` |
| **Frontend B** | `components/ClaimResult.tsx`, animations, styling polish | now — feed it a fixture `ClaimResult` from `lib/types.ts` |
| **AI** | `lib/claude.ts`, `lib/whisper.ts`, prompts | now — unit-test against real inputs via a small script in `scripts/` |
| **bunq** | `lib/bunq.ts` | now — hit sandbox from a throwaway script, then drop into the wrapper |
| **Glue** | `app/api/claim/route.ts`, `lib/rules.ts` | after AI + bunq stubs return |

## Non-goals

Explicitly **not** building:

- Real authentication / accounts (the demo uses a fixed sandbox user).
- A second claim type beyond broken screen + flight delay.
- Persistent storage / claim history (stateless API; re-demo by refreshing).
- Fraud detection beyond "does the photo match the claim".
- Admin / escalation UI — escalated claims just show a friendly message.

If it doesn't land in the judges' 30-second demo, cut it.

## Demo resilience

Things that break on stage, and mitigations:

- **bunq API down** → have a canned `PayoutReceipt` fallback behind a `DEMO_MODE` env var. Never show a red error.
- **Slow Whisper** → cap audio at 30s client-side; show a shimmering "Analyzing…" state so dead air feels intentional.
- **Wi-Fi dies** → pre-record one full happy-path run as a `<video>` backup on the landing page.
