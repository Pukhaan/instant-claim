# `web/` — Instant Claim frontend

Next.js 16 (App Router) + Tailwind 4 + framer-motion. Server components for live bunq data, server actions for *Add Money*, and a same-origin `/api/[...path]` catch-all proxy that hides the FastAPI backend behind one origin (no CORS, no client-side secrets).

## Run

```bash
cd web
npm install
cp .env.local.example .env.local        # API_BASE_URL=http://localhost:8000
npm run dev
```

Open <http://localhost:3000>. The backend must be running at `API_BASE_URL`.

## Routes

| Path | What it is | Component |
|------|------------|-----------|
| `/` | bunq-style home — live balance, recent transactions, *Start a Claim* CTA | `app/page.tsx` (Server Component) |
| `/claim` | Finn wizard · 8 stages · iPhone-native | `app/claim/claim-wizard.tsx` |
| `/chat` | Multi-turn Claude tool-use agent over bunq | `app/chat/chat-view.tsx` |
| `/receipt` | Manual receipt upload + match (chat-first version is preferred) | `app/receipt/page.tsx` |
| `/dashboard` | Legacy debug surface | `app/dashboard/page.tsx` |
| `/api/[...path]` | Same-origin proxy to FastAPI | `app/api/[...path]/route.ts` |

## Design system

The Finn-Insurance design system lives under `.snap` in [`app/globals.css`](./app/globals.css). Tokens:

- `--finn-bg` `#05070a` · `--finn-card` `#1c1c1e` · `--finn-separator` `#464646`
- `--finn-text` `#f5f7fa` · `--finn-muted` `#98989f` · `--finn-body` `#8c99a6`
- `--finn-blue` `#0c9bff` (primary CTA) · `--finn-success` `#29cc88` (payout)
- `--finn-orange` `#ff7819` / `--finn-orange-fill` `#66300a` (numbered step badges)
- `--finn-danger` `#ed4d4d`

Avatars at [`public/finn/`](./public/finn/) — `neutral` · `happy` · `thinking` · `celebrate` — all from the Finn-Insurance Figma file.

## Deploy

```bash
vercel deploy --prod --yes
vercel alias set <new-url> teller-eight.vercel.app
```

The Vercel project is **`teller`** (org: `andreaskruszakin-gmailcoms-projects`). Production env: `API_BASE_URL=https://teller-api.fly.dev`. Root directory is `web/`.

## Notes

- Next.js 16 has breaking changes from prior versions. See [`AGENTS.md`](./AGENTS.md) — consult `node_modules/next/dist/docs/` before assuming an API exists.
- Don't introduce cross-origin requests. All client-side fetches go through `/api/[...path]`. The proxy strips hop-by-hop headers and forwards raw bytes (multipart uploads stay intact).
