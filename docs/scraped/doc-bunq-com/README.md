# doc.bunq.com scrape

Snapshot of the visual design tokens powering <https://doc.bunq.com> (GitBook-powered), captured 2026-04-24.

## Files

- `home.html` — raw HTML dump of the homepage. Contains the inline CSS custom-property block that drives the whole theme.
- `design-tokens.json` — light + dark `--primary-*` and `--tint-*` ramps, extracted as hex. Source of truth for our Tailwind tokens.
- `fonts.md` — font choice (Inter) and rationale for self-hosting via `next/font`.

## Key findings

- **Accent colour:** `#FF6A00` (warm orange, `--primary-9`). bunq's app marketing uses green, but the docs lean warm. We match the docs.
- **Font:** Inter via GitBook's `font-Inter` class, default Tailwind type scale.
- **Radius:** medium — GitBook's `rounded-corners` class variant, which maps to `rounded-xl` / `rounded-2xl` on cards and buttons.
- **Appearance:** dark mode by default, with parallel light palette.
- **Shadow:** `depth-subtle` (Tailwind `shadow-xs` → `shadow-md` on hover).

## How this is used

Phase 2 of [bunq-theme-and-deploy](../../../.cursor/plans/bunq-theme-and-deploy_fe9bbf12.plan.md) rewrites [`web/app/globals.css`](../../../web/app/globals.css) using these tokens and swaps the font in [`web/app/layout.tsx`](../../../web/app/layout.tsx).
