"use client";

// Voice-note stage — fourth step (4/6) of the claim flow. Mirrors Figma node
// 83:182. Three sub-states: idle (mic ready), recording (live waveform + stop),
// transcribing (post-record processing). The orchestrator drives state and
// transitions; this screen has no Continue CTA of its own.

import Waveform from "../../chat/waveform";
import FinnAvatar from "../../finn-avatar";

type VoiceState = "idle" | "recording" | "transcribing";

type Props = {
  state: VoiceState;
  /** Elapsed seconds in the current recording (0..maxSeconds). */
  elapsedSeconds: number;
  /** Max recording length, e.g. 20. */
  maxSeconds: number;
  /** Live mic stream while recording; null otherwise. */
  stream: MediaStream | null;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onBack: () => void;
};

const PROMPTS: ReadonlyArray<{ title: string; sub: string }> = [
  {
    title: "When did it happen?",
    sub: "Time of day, hour, date if possible",
  },
  {
    title: "What were you doing?",
    sub: "Walking, biking, working, home, etc.",
  },
  {
    title: "Where were you?",
    sub: "City, neighborhood, indoors/outdoors",
  },
  {
    title: "What broke?",
    sub: "Screen, body, internals — describe damage",
  },
  {
    title: "How did it happen?",
    sub: "Dropped, hit, water, theft attempt",
  },
];

export default function VoiceStage({
  state,
  elapsedSeconds,
  stream,
  onStart,
  onStop,
  onCancel: _onCancel,
  onBack,
}: Props) {
  const recording = state === "recording";

  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* ── Nav row ─────────────────────────────────────────────────────── */}
      <div className="relative flex h-11 items-center px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] active:opacity-70"
        >
          <ChevronLeft />
        </button>
        <span className="ml-2 text-[17px] font-semibold leading-none text-white">
          Voice Note
        </span>
        <span className="ml-auto text-[13px] font-medium text-[#8c99a6]">
          4/6
        </span>
      </div>

      {/* ── Progress bar — 6 segments, first 4 filled ───────────────────── */}
      <div className="mt-3 flex gap-1 px-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < 4 ? "bg-[#08f]" : "bg-white/[0.08]"
            }`}
          />
        ))}
      </div>

      {/* ── Rainbow Finn ────────────────────────────────────────────────── */}
      <div className="mt-6 px-5">
        <FinnAvatar size={80} />
      </div>

      {/* ── Heading ─────────────────────────────────────────────────────── */}
      <h1 className="mt-6 px-5 text-[34px] font-extrabold leading-[1.05] tracking-[-1px] text-white">
        Tell me what happened, with as much detail as possible.
      </h1>

      <p className="mt-3 px-5 text-[14px] leading-[20px] text-[#8c99a6]">
        I&apos;ll transcribe and pull out the facts as you talk.
      </p>

      {/* ── Recorder strip ──────────────────────────────────────────────── */}
      <div className="mx-5 mt-6 rounded-[16px] bg-[#1c1c1e] p-2">
        <div className="flex h-[88px] items-center gap-3">
          {/* Stop / mic button */}
          <button
            type="button"
            onClick={recording ? onStop : onStart}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full active:opacity-80"
            style={{
              background: "white",
            }}
          >
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#08f]">
              {recording ? (
                <span className="h-4 w-4 rounded-[3px] bg-white" />
              ) : (
                <MicIcon />
              )}
            </span>
          </button>

          {/* Waveform — fills remaining space */}
          <div className="flex h-full flex-1 items-center pr-2">
            <Waveform
              stream={recording ? stream : null}
              bars={28}
              barClassName={
                recording
                  ? "bg-white/95"
                  : "bg-white/25"
              }
            />
          </div>
        </div>

        {/* Status row */}
        <div className="flex h-12 items-center gap-2 px-2">
          {recording ? (
            <>
              <span className="h-[7px] w-[7px] rounded-full bg-[#ff3b30]" />
              <span className="text-[11px] font-bold tracking-[0.06em] text-white">
                RECORDING
              </span>
            </>
          ) : (
            <span className="text-[11px] font-bold tracking-[0.06em] text-[#8c99a6]">
              {state === "transcribing" ? "TRANSCRIBING" : "READY"}
            </span>
          )}
          <span className="ml-auto text-[13px] font-medium tabular-nums text-[#8c99a6]">
            {formatTime(elapsedSeconds)}
          </span>
        </div>
      </div>

      {/* ── Prompts list ────────────────────────────────────────────────── */}
      <div className="mx-5 mt-5 rounded-[16px] bg-[#1c1c1e] p-4 text-[#8c99a6]">
        <p className="mb-3 text-[13px] leading-[16px]">
          In your voice message, cover these — in any order. It will help me get
          you the most coverage.
        </p>
        <ul className="flex flex-col gap-3">
          {PROMPTS.map((p, i) => (
            <li key={p.title} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[14px] font-semibold text-white">
                {i + 1}
              </span>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-white">
                  {p.title}
                </span>
                <span className="text-[13px] text-[#8c99a6]">{p.sub}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* spacer so the fixed hint never overlaps content on short viewports */}
      <div className="h-24" />

      {/* ── Bottom hint (no CTA — orchestrator handles transitions) ─────── */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 px-5 pb-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
        }}
      >
        <p className="text-center text-[12px] text-[#6b7480]">
          {recording
            ? "Tap stop when you're done"
            : state === "transcribing"
              ? "Transcribing your message…"
              : "Tap mic to start recording"}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rainbow Finn — copy of the avatar from bunq-home.tsx so the stage stays
// self-contained.
// ─────────────────────────────────────────────────────────────────────────────

function RainbowFinn({ size = 80 }: { size?: number }) {
  const eyeOffsetTop = size * 0.36;
  const eyeWidth = size * 0.07;
  const eyeHeight = size * 0.13;
  const eyeFromCenter = size * 0.18;
  return (
    <div
      className="relative rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00e0ff, #0088ff, #ff2d92, #ff3b30)",
        padding: 2.5,
      }}
      aria-hidden
    >
      <div
        className="relative flex h-full w-full items-center justify-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, #2a1f3a 0%, #0a0710 100%)",
        }}
      >
        <span
          className="absolute rounded-full bg-white"
          style={{
            width: eyeWidth,
            height: eyeHeight,
            top: eyeOffsetTop,
            left: `calc(50% - ${eyeFromCenter}px - ${eyeWidth / 2}px)`,
          }}
        />
        <span
          className="absolute rounded-full bg-white"
          style={{
            width: eyeWidth,
            height: eyeHeight,
            top: eyeOffsetTop,
            right: `calc(50% - ${eyeFromCenter}px - ${eyeWidth / 2}px)`,
          }}
        />
        <svg
          className="absolute"
          style={{
            top: size * 0.55,
            width: size * 0.4,
            height: size * 0.18,
            left: "50%",
            transform: "translateX(-50%)",
          }}
          viewBox="0 0 32 14"
          fill="none"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
        >
          <path d="M3 3c2.5 5 8 8 13 8s10.5-3 13-8" />
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG icons
// ─────────────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="white"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path
        d="M5 11a7 7 0 0014 0M12 18v3"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
