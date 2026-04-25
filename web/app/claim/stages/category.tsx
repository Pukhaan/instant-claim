"use client";

// SnapClaim · Stage 2 — "Pick a category"
// Matches the Figma node 53:24 (SC-02 · Start a claim) 1:1.
// Dark canvas (#05070a), SF Pro Rounded, 6 category cards in a 2×3 grid,
// fixed lime "Continue · {Category}" CTA at the bottom. Scoped under `.snap`
// so the SF Pro Rounded font stack from globals.css applies automatically.

import type { ReactNode } from "react";

// ────────────────────────────────────────────────────────────────────────────
// Public contract — orchestrator (claim-wizard.tsx) consumes these.
// ────────────────────────────────────────────────────────────────────────────

export type CategoryId =
  | "damaged"
  | "stolen"
  | "medical"
  | "travel"
  | "vehicle"
  | "other";

export type Category = {
  id: CategoryId;
  label: string;
  sub: string;
  /** Tinted background for the icon chip (hex/rgba from Figma) */
  iconBg: string;
  /** Tone colour for the icon glyph itself */
  iconColor: string;
};

export const CATEGORIES: Category[] = [
  {
    id: "damaged",
    label: "Damaged item",
    sub: "Phone, glasses, gear",
    iconBg: "rgba(225,130,56,0.18)",
    iconColor: "#e18238",
  },
  {
    id: "stolen",
    label: "Stolen item",
    sub: "Phone, bag, bike",
    iconBg: "rgba(221,90,65,0.18)",
    iconColor: "#dd5a41",
  },
  {
    id: "medical",
    label: "Medical",
    sub: "Doctor, dentist, ER",
    iconBg: "rgba(111,190,92,0.18)",
    iconColor: "#6fbe5c",
  },
  {
    id: "travel",
    label: "Travel",
    sub: "Delays, lost luggage",
    iconBg: "rgba(61,125,195,0.18)",
    iconColor: "#3d7dc3",
  },
  {
    id: "vehicle",
    label: "Vehicle",
    sub: "Bike, scooter, car",
    iconBg: "rgba(92,102,199,0.18)",
    iconColor: "#5c66c7",
  },
  {
    id: "other",
    label: "Other",
    sub: "Tell Finn anything",
    iconBg: "rgba(140,153,166,0.18)",
    iconColor: "#8c99a6",
  },
];

type Props = {
  selectedId: CategoryId | null;
  onSelect: (c: Category) => void;
  onContinue: () => void;
  onBack: () => void;
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
  onClose,
}: Props) {
  const selected = CATEGORIES.find((c) => c.id === selectedId) ?? null;

  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)",
      }}
    >
      {/* Nav bar — back · SnapClaim · close */}
      <div className="relative h-14 px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="absolute left-3 top-2 flex h-10 w-10 items-center justify-center rounded-[20px] bg-white/[0.06] text-white active:opacity-70"
        >
          <ChevronLeft />
        </button>
        <p className="pt-[18px] text-center text-[17px] font-semibold leading-none text-white">
          SnapClaim
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-2 flex h-10 w-10 items-center justify-center rounded-[20px] bg-white/[0.06] text-white active:opacity-70"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Step pills — first wide+lime, rest small grey */}
      <div className="flex items-center justify-center gap-2">
        <span className="h-[6px] w-6 rounded-[3px] bg-[#a8db45]" />
        <span className="h-[6px] w-[6px] rounded-[3px] bg-white/[0.15]" />
        <span className="h-[6px] w-[6px] rounded-[3px] bg-white/[0.15]" />
        <span className="h-[6px] w-[6px] rounded-[3px] bg-white/[0.15]" />
        <span className="h-[6px] w-[6px] rounded-[3px] bg-white/[0.15]" />
      </div>

      {/* Finn row — avatar + speech bubble */}
      <div className="mt-[26px] flex items-start gap-3 px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#a8db45]">
          <span
            className="text-[18px] leading-none text-[#05070a]"
            style={{ fontWeight: 900 }}
          >
            F
          </span>
        </div>
        <div
          className="h-[70px] flex-1 overflow-hidden bg-[#12151a] px-4 py-3"
          style={{ borderRadius: "4px 18px 18px 18px" }}
        >
          <p className="text-[11px] font-medium leading-none text-[#a8db45]">
            Hi, I&rsquo;m Finn &middot; your AI claims agent
          </p>
          <p className="mt-1.5 text-[14px] font-semibold leading-[19px] text-white">
            What kind of mishap do you want to report?
          </p>
        </div>
      </div>

      {/* Heading + subtitle */}
      <div className="mt-8 px-5">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.7px] text-white">
          Pick a category
        </h1>
        <p className="mt-2 text-[13px] leading-tight text-[#8c99a6]">
          Tap the closest match &mdash; Finn handles the rest.
        </p>
      </div>

      {/* 2×3 grid of category cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 px-5">
        {CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            selected={cat.id === selectedId}
            onClick={() => onSelect(cat)}
          />
        ))}
      </div>

      {/* Spacer so the grid never sits under the fixed CTA */}
      <div className="flex-1" />

      {/* Continue CTA — fixed at bottom */}
      <div
        className="fixed inset-x-0 bottom-0 px-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <button
          type="button"
          onClick={onContinue}
          disabled={!selected}
          className="flex h-14 w-full items-center justify-center rounded-[28px] bg-[#a8db45] text-[16px] font-bold text-[#05070a] transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue{selected ? ` · ${selected.label}` : ""}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Category card — 175×116, dark surface, optional lime border + check badge
// ────────────────────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  selected,
  onClick,
}: {
  category: Category;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="relative h-[116px] overflow-hidden rounded-[20px] bg-[#12151a] text-left transition-colors active:opacity-90"
      style={{
        border: selected
          ? "1.5px solid rgba(168,219,69,0.6)"
          : "1.5px solid transparent",
      }}
    >
      {/* Icon chip top-left */}
      <div
        className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-[18px]"
        style={{ background: category.iconBg, color: category.iconColor }}
      >
        <CategoryIcon id={category.id} />
      </div>

      {/* Title + sub */}
      <p className="absolute left-3 top-[58px] whitespace-nowrap text-[15px] font-semibold leading-none text-white">
        {category.label}
      </p>
      <p className="absolute left-3 top-[80px] text-[11px] leading-none text-[#8c99a6]">
        {category.sub}
      </p>

      {/* Selected check badge */}
      {selected && (
        <span
          className="absolute right-[12.5px] top-[12.5px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#a8db45]"
          aria-hidden
        >
          <CheckIcon />
        </span>
      )}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Inline SVG icons — clean, no external library
// ────────────────────────────────────────────────────────────────────────────

function withIcon(node: ReactNode): ReactNode {
  return node;
}

function CategoryIcon({ id }: { id: CategoryId }) {
  switch (id) {
    case "damaged":
      return withIcon(<WarningIcon />);
    case "stolen":
      return withIcon(<ProhibitIcon />);
    case "medical":
      return withIcon(<PlusCircleIcon />);
    case "travel":
      return withIcon(<PlaneIcon />);
    case "vehicle":
      return withIcon(<CarIcon />);
    case "other":
      return withIcon(<SparkleIcon />);
  }
}

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

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="#05070a"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 6.5l2.5 2.5L10 3.5" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 2.5L16 14.5H2L9 2.5z" />
      <path d="M9 7v3.5" />
      <circle cx="9" cy="12.6" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ProhibitIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="9" r="6.5" />
      <path d="M4.4 4.4l9.2 9.2" />
    </svg>
  );
}

function PlusCircleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 5.5v7M5.5 9h7" />
    </svg>
  );
}

function PlaneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 1 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 13l2-5a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 8l2 5" />
      <path d="M3 13h18v4a1 1 0 0 1-1 1h-1.5a1.5 1.5 0 0 1-3 0H8.5a1.5 1.5 0 0 1-3 0H4a1 1 0 0 1-1-1v-4z" />
      <circle cx="7" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="currentColor"
      aria-hidden
    >
      <path d="M9 1.5l1.5 4.5L15 7.5l-4.5 1.5L9 13.5 7.5 9 3 7.5 7.5 6 9 1.5z" />
      <path d="M14 12l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
    </svg>
  );
}
