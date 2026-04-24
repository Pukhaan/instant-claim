// Pill — small uppercase mono label, used everywhere (step indicators,
// metadata chips, status badges). Mirror of the SnapClaim design primitive.

import { cn } from "@/lib/cn";

type Tone = "neutral" | "lime" | "amber" | "red" | "blue";

const TONES: Record<Tone, string> = {
  neutral: "bg-white/[0.06] text-text-soft border-white/[0.08]",
  lime: "bg-lime-faint text-lime border-lime-border",
  amber: "bg-signal-amber/10 text-signal-amber border-signal-amber/25",
  red: "bg-signal-red/10 text-signal-red border-signal-red/25",
  blue: "bg-signal-blue/10 text-signal-blue border-signal-blue/25",
};

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PillDot({ tone = "lime" }: { tone?: Tone }) {
  const colors: Record<Tone, string> = {
    neutral: "bg-text-soft",
    lime: "bg-lime",
    amber: "bg-signal-amber",
    red: "bg-signal-red",
    blue: "bg-signal-blue",
  };
  return <span className={cn("h-1.5 w-1.5 rounded-full", colors[tone])} />;
}
