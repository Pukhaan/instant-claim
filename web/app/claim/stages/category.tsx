"use client";

import FinnAvatar from "../../finn-avatar";

// SnapClaim · Stage 2 — "What kind of mishap do you want to report?"
// Figma node 95:249 (frame 2/6). Single inset list with radios on a dark
// canvas (#05070a). Scoped under `.snap` so the SF Pro Rounded font stack
// from globals.css applies automatically.

// ────────────────────────────────────────────────────────────────────────────
// Public contract — orchestrator (claim-wizard.tsx) consumes these.
// ────────────────────────────────────────────────────────────────────────────

export type CategoryId =
  | "damaged"
  | "travel"
  | "medical"
  | "luggage"
  | "other";

export type Category = {
  id: CategoryId;
  label: string;
  sub: string;
  /** Kept for backward-compat with the orchestrator; not rendered in this design. */
  iconBg: string;
  /** Kept for backward-compat with the orchestrator; not rendered in this design. */
  iconColor: string;
};

export const CATEGORIES: Category[] = [
  {
    id: "damaged",
    label: "Device Damage",
    sub: "Phone screen, laptop, camera..",
    iconBg: "rgba(225,130,56,0.18)",
    iconColor: "#e18238",
  },
  {
    id: "travel",
    label: "Travel Delay",
    sub: "If the flight or train got cancelled",
    iconBg: "rgba(61,125,195,0.18)",
    iconColor: "#3d7dc3",
  },
  {
    id: "medical",
    label: "Medical Care",
    sub: "Bill, ambulance, hospital...",
    iconBg: "rgba(111,190,92,0.18)",
    iconColor: "#6fbe5c",
  },
  {
    id: "luggage",
    label: "Lost Luggage",
    sub: "Delayed, stolen, or misrouted bags",
    iconBg: "rgba(168,113,221,0.18)",
    iconColor: "#a871dd",
  },
  {
    id: "other",
    label: "Something Else",
    sub: "Describe what happened. I will try to help",
    iconBg: "rgba(140,153,166,0.18)",
    iconColor: "#8c99a6",
  },
];

type Props = {
  selectedId: CategoryId | null;
  onSelect: (c: Category) => void;
  onContinue: () => void;
  onBack: () => void;
  /** Unused in the new design but kept on the prop contract. */
  onClose: () => void;
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export default function CategoryStage({
  selectedId,
  onSelect,
  onContinue,
  onBack,
}: Props) {
  const hasSelection = selectedId !== null;

  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 132px)",
      }}
    >
      {/* Nav row — back · inline title · 2/6 caption */}
      <div className="relative flex h-11 items-center px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white active:opacity-70"
        >
          <ChevronLeft />
        </button>
        <span className="ml-2 text-[17px] font-semibold leading-none text-white">
          Category
        </span>
        <span className="ml-auto pr-2 text-[13px] font-normal leading-none text-[#8c99a6]">
          2/6
        </span>
      </div>

      {/* Progress bar — 6 segments, first 2 filled */}
      <div className="mt-3 flex items-center gap-1 px-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{
              background: i < 2 ? "#08f" : "rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>

      {/* Rainbow Finn avatar */}
      <div className="mt-6 px-5">
        <FinnAvatar />
      </div>

      {/* Heading */}
      <h1 className="mt-6 px-5 text-[34px] font-extrabold leading-[1.1] tracking-[-1px] text-white">
        What kind of mishap do you want to report?
      </h1>

      {/* Subtitle */}
      <p className="mt-3 px-5 text-[14px] leading-[20px] text-[#8c99a6]">
        Pick the closest match. Then take a picture of what happened. I use this
        to frame the right questions. You can add nuance in your voice note in
        the next step.
      </p>

      {/* Single inset list */}
      <div
        role="radiogroup"
        aria-label="Mishap category"
        className="mt-6 mx-5 overflow-hidden rounded-[18px] bg-[#1c1c1e]"
      >
        {CATEGORIES.map((cat, idx) => {
          const isLast = idx === CATEGORIES.length - 1;
          const selected = cat.id === selectedId;
          return (
            <button
              key={cat.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(cat)}
              className="flex w-full items-center justify-between px-4 py-4 text-left active:opacity-80"
              style={{
                borderBottom: isLast
                  ? "none"
                  : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="flex flex-col">
                <span className="text-[17px] font-semibold leading-tight text-white">
                  {cat.label}
                </span>
                <span className="mt-0.5 text-[13px] leading-tight text-[#8c99a6]">
                  {cat.sub}
                </span>
              </span>
              <Radio selected={selected} />
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Bottom hint + CTA — fixed */}
      <div
        className="fixed inset-x-0 bottom-0 px-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <p className="mb-2 text-center text-[12px] leading-tight text-[#6b7480]">
          Next take a picture of what happened
        </p>
        <button
          type="button"
          onClick={onContinue}
          disabled={!hasSelection}
          className="flex h-14 w-full items-center justify-center rounded-[28px] bg-[#08f] text-[16px] font-bold text-white transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to camera
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Rainbow Finn — 80×80 conic-rainbow ring around a soft purple→black orb
// with two pill eyes and a small smile arc.
// ────────────────────────────────────────────────────────────────────────────

function RainbowFinn() {
  return (
    <div
      className="relative h-20 w-20 rounded-full"
      style={{
        background:
          "conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00e0ff, #0088ff, #ff2d92, #ff3b30)",
        padding: "2.5px",
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
        {/* Eyes */}
        <span
          className="absolute h-[10px] w-[5px] rounded-full bg-white"
          style={{ left: "27px", top: "30px" }}
        />
        <span
          className="absolute h-[10px] w-[5px] rounded-full bg-white"
          style={{ right: "27px", top: "30px" }}
        />
        {/* Smile */}
        <svg
          width="22"
          height="10"
          viewBox="0 0 22 10"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          className="absolute"
          style={{ bottom: "20px" }}
        >
          <path d="M2 2 Q 11 9 20 2" />
        </svg>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Radio (24×24)
// ────────────────────────────────────────────────────────────────────────────

function Radio({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#08f]"
        aria-hidden
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7.5l2.5 2.5L11 4.5" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="h-6 w-6 shrink-0 rounded-full"
      style={{ border: "1.5px solid rgba(255,255,255,0.25)" }}
      aria-hidden
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Inline icons
// ────────────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 4l-6 6 6 6" />
    </svg>
  );
}
