# Contributing — team workflow

One-day hackathon. Move fast, don't break `main`.

## Getting set up

```bash
git clone <repo-url>
cd instant-claim
npm install
cp .env.local.example .env.local   # ask the team lead for the keys
npm run dev                        # http://localhost:3000
```

## Branch naming

Cut a branch per track. Short, lowercase, hyphenated:

| Track | Branch prefix | Example |
| --- | --- | --- |
| Claim form + inputs | `frontend-a/` | `frontend-a/photo-upload` |
| Result screen + animations | `frontend-b/` | `frontend-b/approved-animation` |
| Claude + Whisper | `ai/` | `ai/claude-vision-prompt` |
| bunq sandbox integration | `bunq/` | `bunq/payout-flow` |
| API glue + rules | `glue/` | `glue/claim-route` |

## Workflow

1. `git checkout main && git pull`
2. `git checkout -b <track>/<short-description>`
3. Commit often. Small commits > one giant commit.
4. Push: `git push -u origin <branch-name>`
5. Open a PR into `main`. Tag one teammate. Merge once you have a thumbs-up — don't wait for CI heroics.

## Keep the seams clean

- **`lib/types.ts` is the contract.** If you change `ClaimResult`, `ClaimFacts`, or `DamageAnalysis`, update both sides in the same PR and ping the team in chat.
- **Don't import across tracks.** Frontend A shouldn't import from Frontend B. The glue layer wires them.
- **Mock early.** Frontend tracks can return a hardcoded `ClaimResult` fixture until the backend is ready. AI track can write a `scripts/test-claude.ts` to iterate without the UI.

## Secrets

- **Never commit `.env.local`.** `.gitignore` blocks it — double-check with `git status` before every push.
- Share keys via a private channel (1Password, Signal, DMs). Not in the repo, not in Slack public channels, not in screenshots.
- If a key leaks: rotate it immediately and tell the team.

## Commit messages

Conventional-ish, short:

```
feat(form): wire up voice recorder with 30s cap
fix(bunq): refresh session on 401
chore: bump tailwind
```

## Before you open a PR

- `npm run build` passes locally
- No `.env.local` in `git status`
- Screenshot or 5s screen-recording attached if it's a UI change — makes review 10x faster
