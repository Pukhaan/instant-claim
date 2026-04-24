# Fonts — doc.bunq.com

## Observed

The site uses **Inter**, applied via the GitBook `font-Inter` class on `<html>`. No custom `@font-face` overrides. Inter is provided by GitBook's own font stack (likely self-hosted variants of the Google Font).

## Recommendation for Teller

Use **Inter** via `next/font/google` so we get a single, self-hosted, variable version with zero CLS.

```ts
// web/app/layout.tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
```

Apply `${inter.variable}` on `<html>` and set Tailwind `--font-sans: var(--font-sans)` so every text element picks it up.

## Mono

doc.bunq.com uses the browser monospace default for `<code>` blocks (no custom override visible in the inline CSS). We'll keep **Geist Mono** as our mono — Inter + Geist Mono is a common, legible pairing.

## Type scale

GitBook uses Tailwind's default: `text-xs` through `text-4xl`. Observed patterns:

- Page H1: `text-3xl` → `text-4xl` with tight tracking, semibold
- Section H2: `text-2xl`, semibold, generous top margin
- Body: `text-base` (16px) with `leading-relaxed`
- UI labels / chips: `text-xs uppercase tracking-wide` on muted tint

Keep our existing `text-balance` on headings and `text-pretty` on body paragraphs.
