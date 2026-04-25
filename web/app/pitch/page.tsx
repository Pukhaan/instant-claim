"use client";

// /pitch — Finn pitch deck. Same dark Finn-Insurance design tokens as the
// rest of the app. 12 slides, navigable via:
//   ← / →  arrow keys  ·  Space / Enter  ·  click anywhere on the slide
//   Esc — exit fullscreen
//   F  — toggle fullscreen
//
// Built as a single client component so it's keyboard-driven with no
// server round-trip between slides. Slides animate in/out with framer-
// motion (fade + slight x-translate) at the same 220ms ease-out the
// claim wizard uses.

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SLIDES: { kind: string; render: () => React.ReactNode }[] = [
  { kind: "cover", render: () => <SlideCover /> },
  { kind: "problem", render: () => <SlideProblem /> },
  { kind: "cost", render: () => <SlideCost /> },
  { kind: "solution", render: () => <SlideSolution /> },
  { kind: "flow", render: () => <SlideFlow /> },
  { kind: "ai", render: () => <SlideAI /> },
  { kind: "modal", render: () => <SlideMultimodal /> },
  { kind: "bunq", render: () => <SlideBunq /> },
  { kind: "roi", render: () => <SlideROI /> },
  { kind: "demo", render: () => <SlideDemo /> },
  { kind: "stack", render: () => <SlideStack /> },
  { kind: "team", render: () => <SlideTeam /> },
];

export default function PitchDeck() {
  const [i, setI] = useState(0);

  const next = useCallback(() => setI((n) => Math.min(n + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setI((n) => Math.max(n - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        prev();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        const el = document.documentElement;
        if (document.fullscreenElement) document.exitFullscreen();
        else el.requestFullscreen?.();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Touch swipe on mobile
  useEffect(() => {
    let startX = 0;
    function onStart(e: TouchEvent) {
      startX = e.touches[0]?.clientX ?? 0;
    }
    function onEnd(e: TouchEvent) {
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const dx = endX - startX;
      if (Math.abs(dx) < 50) return;
      if (dx < 0) next();
      else prev();
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [next, prev]);

  const slide = SLIDES[i];

  return (
    <div
      className="snap relative h-[100dvh] w-full overflow-hidden bg-[var(--finn-bg)] text-[var(--finn-text)]"
      onClick={(e) => {
        // Click left third = prev, anywhere else = next.
        const x = e.clientX / window.innerWidth;
        if (x < 0.33) prev();
        else next();
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.kind}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: [0.2, 0.7, 0.3, 1] }}
          className="absolute inset-0 flex items-center justify-center px-6 md:px-16"
        >
          <div className="w-full max-w-5xl">{slide.render()}</div>
        </motion.div>
      </AnimatePresence>

      {/* Slide counter + progress strip */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 px-6 pb-6 md:px-16 md:pb-10">
        <div className="flex h-[3px] gap-[5px]">
          {SLIDES.map((_, idx) => (
            <span
              key={idx}
              className={`h-full flex-1 rounded-full transition-colors ${
                idx <= i ? "bg-[var(--finn-blue)]" : "bg-[var(--finn-card)]"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--finn-muted)]">
          <span className="tabular-nums">
            {String(i + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
          </span>
          <span className="hidden md:block">
            ← / →  ·  space  ·  press F for fullscreen
          </span>
          <Link href="/" className="pointer-events-auto text-[var(--finn-blue)] hover:underline">
            ← back to app
          </Link>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Slides
// ════════════════════════════════════════════════════════════════════════════

function SlideCover() {
  return (
    <div className="flex flex-col items-start gap-8 md:gap-12">
      <div className="flex items-center gap-5">
        <Image src="/AI_Logo.png" alt="Finn" width={88} height={88} priority />
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[var(--finn-blue)]">
            Built for the bunq AI Agents Hackathon · April 2026
          </p>
          <p className="mt-1 text-[14px] font-semibold text-[var(--finn-muted)]">Andreas · David · Valeriu</p>
        </div>
      </div>
      <div>
        <h1 className="text-[clamp(48px,8vw,108px)] font-extrabold leading-[0.96] tracking-tight text-balance">
          Finn.
          <br />
          <span className="text-[var(--finn-blue)]">Insurance claims</span>
          <br />
          should be one tap.
        </h1>
        <p className="mt-6 max-w-2xl text-[clamp(17px,2vw,22px)] leading-snug text-[var(--finn-body)] text-pretty">
          A multimodal AI claims assistant that lives natively inside bunq. A photo, a voice
          note, an instant payout — never leaves the app.
        </p>
      </div>
    </div>
  );
}

function SlideProblem() {
  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <SlideKicker>The problem</SlideKicker>
      <h2 className="text-[clamp(36px,6vw,80px)] font-extrabold leading-[1.02] tracking-tight text-balance">
        bunq's premium plans bundle real insurance.
        <br />
        <span className="text-[var(--finn-muted)]">
          The moment users need it, they're pushed onto someone else's website.
        </span>
      </h2>
      <p className="max-w-3xl text-[clamp(17px,1.6vw,20px)] leading-snug text-[var(--finn-body)] text-pretty">
        Easy Travel · Easy Money · Elite include device + travel cover underwritten by Quvos.
        At the moment of damage, customers leave bunq, fill a 14-field form on a third-party
        portal, re-enter data bunq already holds, and wait 7–14 days. The most stressful
        financial moment of their year happens outside the app — and that is precisely where
        retention is silently lost.
      </p>
    </div>
  );
}

function SlideCost() {
  return (
    <div className="flex flex-col gap-10">
      <SlideKicker>What it costs today</SlideKicker>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat headline="<15%" sub="utilization on bundled insurance" tone="muted" />
        <Stat headline="€30–80" sub="cost per manual claim ticket" tone="orange" />
        <Stat headline="7–14 days" sub="from claim filed to decision" tone="muted" />
      </div>
      <p className="max-w-3xl text-[clamp(16px,1.5vw,19px)] leading-snug text-[var(--finn-body)]">
        Premium subscribers pay every month for a benefit they will never use. When they finally
        do, the experience is so painful it drives the strongest cohort of paying users to
        downgrade. Falling utilization → falling perceived value → falling NPS → silent churn
        from the highest-paying tier.
      </p>
    </div>
  );
}

function SlideSolution() {
  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <SlideKicker>The solution</SlideKicker>
      <h2 className="text-[clamp(38px,6vw,80px)] font-extrabold leading-[1.02] tracking-tight text-balance">
        Tap.{" "}
        <span className="text-[var(--finn-blue)]">Snap.</span>{" "}
        <span className="text-[var(--finn-orange)]">Speak.</span>{" "}
        <span className="text-[var(--finn-success)]">Paid.</span>
      </h2>
      <p className="max-w-3xl text-[clamp(17px,1.6vw,21px)] leading-snug text-[var(--finn-body)] text-pretty">
        Finn replaces the entire third-party claim flow with a 60-second conversation. The user
        photographs the damage and speaks naturally about what happened. Finn matches the
        incident to the underlying bunq transaction, confirms Quvos policy coverage, and queues
        an instant payout to the user's main account. Quvos receives a clean pre-validated
        submission. The user never leaves bunq.
      </p>
    </div>
  );
}

function SlideFlow() {
  return (
    <div className="flex flex-col gap-8">
      <SlideKicker>The flow</SlideKicker>
      <h2 className="text-[clamp(28px,4vw,52px)] font-extrabold leading-[1.05] tracking-tight">
        Six steps. Sixty seconds.
      </h2>
      <ol className="grid gap-3 md:grid-cols-2">
        {[
          ["1", "Tap Start a Claim", "from bunq home / Travel-Insurance card"],
          ["2", "Pick a category", "Device · Travel · Medical · Luggage · Other"],
          ["3", "Snap a photo", "Claude Vision classifies what it sees in real time"],
          ["4", "Speak what happened", "AWS Transcribe Streaming · transcript in ~3s"],
          ["5", "Confirm transcript", "Finn's caught the gist of your story"],
          ["6", "Decision", "Approve · Escalate · Reject — with reason"],
        ].map(([n, t, s]) => (
          <li
            key={n}
            className="flex items-start gap-4 rounded-[18px] bg-[var(--finn-card)] p-4 md:p-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[var(--finn-orange)] bg-[var(--finn-orange-fill)] text-[14px] font-extrabold text-white">
              {n}
            </span>
            <div className="min-w-0">
              <p className="text-[18px] font-bold leading-tight text-[var(--finn-text)]">{t}</p>
              <p className="mt-0.5 text-[14px] leading-snug text-[var(--finn-muted)]">{s}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SlideAI() {
  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <SlideKicker>Why AI is core, not bolted on</SlideKicker>
      <h2 className="text-[clamp(32px,5vw,64px)] font-extrabold leading-[1.04] tracking-tight">
        Three model layers replace the form entirely.
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            tone: "blue",
            label: "Vision",
            model: "Claude Sonnet 4.5 · AWS Bedrock",
            body: "Looks at the damage photo, identifies the issue and validates the evidence quality. Drives the live damage label on the Review screen.",
          },
          {
            tone: "orange",
            label: "Speech-to-text",
            model: "AWS Transcribe Streaming",
            body: "Real-time HTTP/2 transcription. ffmpeg transcodes webm → 16 kHz PCM in-process. ~3s warm-state vs ~17s on the legacy batch path.",
          },
          {
            tone: "success",
            label: "Reasoning",
            model: "Claude Sonnet 4.5 · forced tool-use",
            body: "Joins the transcript against 30 recent bunq transactions, applies the Quvos policy, and emits a structured claim payload + decision in one inference call.",
          },
        ].map((c) => (
          <article
            key={c.label}
            className="rounded-[18px] bg-[var(--finn-card)] p-5 md:p-6"
          >
            <p
              className="text-[12px] font-bold uppercase tracking-[0.14em]"
              style={{
                color:
                  c.tone === "blue"
                    ? "var(--finn-blue)"
                    : c.tone === "orange"
                      ? "var(--finn-orange)"
                      : "var(--finn-success)",
              }}
            >
              {c.label}
            </p>
            <p className="mt-2 text-[15px] font-bold text-[var(--finn-text)]">{c.model}</p>
            <p className="mt-3 text-[14px] leading-snug text-[var(--finn-body)]">{c.body}</p>
          </article>
        ))}
      </div>
      <p className="text-[15px] font-semibold text-[var(--finn-muted)]">
        Take any one out and the demo collapses. That is what AI-as-core means.
      </p>
    </div>
  );
}

function SlideMultimodal() {
  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <SlideKicker>Two non-text modalities, replacing the form</SlideKicker>
      <h2 className="text-[clamp(34px,5.4vw,68px)] font-extrabold leading-[1.04] tracking-tight text-balance">
        <span className="text-[var(--finn-blue)]">Image</span> and{" "}
        <span className="text-[var(--finn-orange)]">audio</span> aren't decoration —
        <br /> they are the entire interface.
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[18px] bg-[var(--finn-card)] p-5 md:p-6">
          <p className="text-[40px]">📷</p>
          <p className="mt-2 text-[18px] font-bold">Image</p>
          <p className="mt-2 text-[14px] leading-snug text-[var(--finn-body)]">
            Photograph the damaged device, delay board, medical bill, or luggage tag. Claude
            Vision identifies the issue, surfaces a bounding box for confirmation, and validates
            evidence quality on the spot. Re-shoot is one tap if the model is uncertain.
          </p>
        </article>
        <article className="rounded-[18px] bg-[var(--finn-card)] p-5 md:p-6">
          <p className="text-[40px]">🎤</p>
          <p className="mt-2 text-[18px] font-bold">Audio</p>
          <p className="mt-2 text-[14px] leading-snug text-[var(--finn-body)]">
            Talk like you would to a friend. Live waveform during recording. Speech transcription
            plus LLM extraction turn natural language into structured claim data — when, where,
            how, severity, third parties — with no typing.
          </p>
        </article>
      </div>
      <p className="max-w-3xl text-[15px] leading-snug text-[var(--finn-muted)]">
        The decision fuses signal from all three: cracked-iPhone photo + "I dropped it walking
        out of a coffee shop" + the matching €1,249 Fonq purchase from 12 days ago must align
        before approval. Mismatch in any modality → escalate to a human, with the conflict
        explained.
      </p>
    </div>
  );
}

function SlideBunq() {
  return (
    <div className="flex flex-col gap-8">
      <SlideKicker>How it plugs into bunq</SlideKicker>
      <h2 className="text-[clamp(32px,5vw,60px)] font-extrabold leading-[1.04] tracking-tight">
        No new partner. No rebuilt product.
        <br />
        Finn sits cleanly on top.
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {[
          ["Launches from bunq home", "Travel / Insurance card on the home screen — already where users look for claims."],
          ["Reads bunq transactions", "Live `monetary-account-bank` + `payment` calls verify the underlying purchase."],
          ["Submits to Quvos via existing intake", "Pre-validated claim payload formatted for Quvos's current API. No renegotiation."],
          ["bunq fronts instant payouts", "For high-confidence low-amount claims, money hits the user's account in seconds; reconciles with Quvos in the background."],
          ["Surfaces claim status in-app", "User never leaves bunq for any part of the claim lifecycle."],
          ["Authenticated with the official toolkit", "RSA-signed sessions, real `api-sandbox.bunq.com` calls, not a mock."],
        ].map(([t, s]) => (
          <li key={t} className="flex items-start gap-3 rounded-[16px] bg-[var(--finn-card)] p-4">
            <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--finn-blue)]" />
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-tight">{t}</p>
              <p className="mt-1 text-[13px] leading-snug text-[var(--finn-muted)]">{s}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SlideROI() {
  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <SlideKicker>Return on investment</SlideKicker>
      <h2 className="text-[clamp(36px,6.5vw,96px)] font-extrabold leading-[0.98] tracking-tight">
        <span className="text-[var(--finn-success)]">€15–20M</span>
        <br />
        <span className="text-[var(--finn-text)]">annual upside,</span>
        <br />
        <span className="text-[var(--finn-muted)]">concentrated on retention.</span>
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {[
          ["Premium-tier churn reduction", "1pt of recovered retention = multi-million ARR per year. The lever that compounds most."],
          ["€1–2M ops savings", "Cost per ticket €30–80 → effectively €0 on AI-assembled claims."],
          ["7-figure commission gain", "Cleaner submissions → higher Quvos approval → leverage to renegotiate the split."],
          ["Premium-plan attach uplift", "\u201CFile your claim by talking to Finn\u201D as a top-of-funnel marketing line."],
          ["Payback in weeks", "Small engineering team, on top of bunq's existing APIs and Quvos's existing intake."],
          ["The user never leaves bunq", "The most stressful financial moment of the year happens natively in the app."],
        ].map(([t, s]) => (
          <li key={t} className="flex items-start gap-3 rounded-[16px] bg-[var(--finn-card)] p-4">
            <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--finn-success)]" />
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-tight">{t}</p>
              <p className="mt-1 text-[13px] leading-snug text-[var(--finn-muted)]">{s}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SlideDemo() {
  return (
    <div className="flex flex-col items-start gap-8">
      <SlideKicker>Live demo</SlideKicker>
      <h2 className="text-[clamp(40px,6.5vw,96px)] font-extrabold leading-[0.98] tracking-tight">
        Try it now.
      </h2>
      <p className="max-w-3xl text-[clamp(16px,1.5vw,19px)] leading-snug text-[var(--finn-body)] text-pretty">
        Open it on a phone, photograph something actually broken, talk normally. The Quvos
        Insurance Payout will land at the top of your transactions before you've put your phone
        down.
      </p>
      <div className="flex flex-col gap-3 rounded-[18px] bg-[var(--finn-card)] p-6 md:p-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--finn-blue)]">
          live URL
        </p>
        <Link
          href="https://teller-eight.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="break-all text-[clamp(20px,2.4vw,32px)] font-extrabold text-[var(--finn-text)] hover:text-[var(--finn-blue)]"
          onClick={(e) => e.stopPropagation()}
        >
          teller-eight.vercel.app
        </Link>
        <p className="text-[13px] leading-snug text-[var(--finn-muted)]">
          Best on iPhone Safari · Add to Home Screen for the full app feel.
        </p>
      </div>
    </div>
  );
}

function SlideStack() {
  return (
    <div className="flex flex-col gap-8">
      <SlideKicker>Tech stack</SlideKicker>
      <h2 className="text-[clamp(28px,4vw,52px)] font-extrabold leading-[1.04] tracking-tight">
        AWS-native, bunq-native, production-grade.
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Frontend", "Next.js 16 App Router · Vercel"],
          ["Styling", "Tailwind 4 · Finn-Insurance design tokens"],
          ["Animation", "framer-motion · live audio waveform"],
          ["LLM", "Claude Sonnet 4.5 via AWS Bedrock (us-east-1)"],
          ["Speech", "AWS Transcribe Streaming (HTTP/2)"],
          ["Audio prep", "ffmpeg in-process webm → 16 kHz PCM"],
          ["Storage", "AWS S3 (auto-provisioned, 7d lifecycle)"],
          ["Backend", "FastAPI · Python 3.13 · Fly.io (ams)"],
          ["Bank", "bunq sandbox API (RSA-signed sessions)"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 rounded-[14px] bg-[var(--finn-card)] px-5 py-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--finn-muted)]">
              {k}
            </p>
            <p className="text-right text-[15px] font-semibold text-[var(--finn-text)]">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideTeam() {
  return (
    <div className="flex flex-col items-start gap-10">
      <SlideKicker>Team</SlideKicker>
      <h2 className="text-[clamp(48px,8vw,108px)] font-extrabold leading-[0.95] tracking-tight">
        Built in 24 hours.
        <br />
        <span className="text-[var(--finn-blue)]">Ready for production.</span>
      </h2>
      <div className="flex flex-wrap gap-4">
        {[
          ["Andreas Kruszakin-Liboska", "@andreaskruszakin"],
          ["David Pukha", "@Pukhaan"],
          ["Valeriu Ilicciev", "@Valeriu01"],
        ].map(([name, handle]) => (
          <div key={handle} className="rounded-[14px] bg-[var(--finn-card)] px-5 py-4">
            <p className="text-[16px] font-bold leading-tight">{name}</p>
            <p className="mt-0.5 text-[13px] font-semibold text-[var(--finn-blue)]">{handle}</p>
          </div>
        ))}
      </div>
      <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[var(--finn-muted)]">
        Thank you · Questions?
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Atoms
// ════════════════════════════════════════════════════════════════════════════

function SlideKicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--finn-blue)]">
      {children}
    </p>
  );
}

function Stat({
  headline,
  sub,
  tone = "muted",
}: {
  headline: string;
  sub: string;
  tone?: "blue" | "orange" | "success" | "muted";
}) {
  const color =
    tone === "blue"
      ? "var(--finn-blue)"
      : tone === "orange"
        ? "var(--finn-orange)"
        : tone === "success"
          ? "var(--finn-success)"
          : "var(--finn-text)";
  return (
    <div className="rounded-[18px] bg-[var(--finn-card)] p-6 md:p-7">
      <p
        className="text-[clamp(40px,5vw,72px)] font-extrabold leading-none tracking-tight"
        style={{ color }}
      >
        {headline}
      </p>
      <p className="mt-3 text-[13px] leading-snug text-[var(--finn-muted)]">{sub}</p>
    </div>
  );
}
