"use client";

// Snap-photo stage — third step of the claim flow. Mirrors Figma node 53:26
// (SC-03 · Snap photo) in spirit but built with flex so it lays out correctly
// on any viewport — iPhone SE → iPhone 16 Pro Max, landscape, or desktop.
//
// The shutter fires `onShutter`; the orchestrator opens the native camera via
// <input type="file" accept="image/*" capture="environment">.

type Props = {
  /** Fires when the lime SNAP shutter is tapped. */
  onShutter: () => void;
  onBack: () => void;
  onClose: () => void;
  /** Shown subtly above the tip pill (e.g. "Damaged item"). */
  categoryLabel?: string;
};

export default function CaptureStage({
  onShutter,
  onBack,
  onClose,
  categoryLabel,
}: Props) {
  return (
    <div
      className="snap relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#030304] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Background — gradient + decorative damaged shape, behind everything */}
      <Viewfinder />

      {/* Top row — close / HDR / flash */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white active:opacity-70"
        >
          <CloseIcon />
        </button>

        <div
          className="flex h-8 items-center justify-center rounded-2xl bg-black/55 px-3"
          aria-hidden
        >
          <span className="text-[11px] font-extrabold tracking-[0.04em] text-white">
            HDR
          </span>
        </div>

        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 active:opacity-70"
        >
          <FlashIcon />
        </button>
      </div>

      {/* Viewfinder area — corner brackets float in the empty middle */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-10">
        <div className="relative aspect-[3/4] w-full max-w-[320px]">
          <Bracket pos="tl" />
          <Bracket pos="tr" />
          <Bracket pos="bl" />
          <Bracket pos="br" />
        </div>
      </div>

      {/* Tip pill + optional category label */}
      <div className="relative z-10 mb-3 flex flex-col items-center gap-1.5">
        {categoryLabel ? (
          <span className="rounded-full bg-black/45 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#08f]">
            {categoryLabel}
          </span>
        ) : null}
        <div className="flex items-center gap-2 rounded-[18px] bg-black/55 px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-[#08f]" aria-hidden />
          <span className="text-[12px] font-semibold text-white">
            Frame the damage clearly
          </span>
        </div>
      </div>

      {/* Bottom toolbar — mode tabs + shutter + library + flip */}
      <div className="relative z-10 bg-black/55 pb-2 pt-2.5">
        {/* Mode tabs */}
        <div className="flex items-center justify-center gap-10 pb-1">
          <ModeLabel active={false} label="VIDEO" />
          <ModeLabel active={false} label="PHOTO" />
          <div className="flex flex-col items-center gap-1">
            <ModeLabel active label="CLAIM" />
            <span className="h-1 w-1 rounded-full bg-[#08f]" aria-hidden />
          </div>
        </div>

        {/* Shutter row */}
        <div className="flex items-center justify-between px-6 pb-1 pt-1">
          <button
            type="button"
            aria-label="Open library"
            className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-white/20 bg-[#333842] active:opacity-70"
          >
            <GridIcon />
          </button>

          <button
            type="button"
            onClick={onShutter}
            aria-label="Take photo"
            className="flex h-[82px] w-[82px] items-center justify-center rounded-full bg-white active:opacity-90"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#08f]">
              <span className="text-[11px] font-extrabold tracking-[0.06em] text-[#05070a]">
                SNAP
              </span>
            </span>
          </button>

          <button
            type="button"
            aria-label="Flip camera"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#333842] text-white active:opacity-70"
          >
            <FlipIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

function Viewfinder() {
  // Decorative "damaged phone" behind the viewfinder. Positioned via
  // percentages so it stays roughly centred on any viewport. This is all
  // decorative — the live photo replaces the backdrop anyway.
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#0d0f1a] via-[#1a2129] to-[#050609]"
    >
      <div className="absolute left-[30%] top-[35%] h-[40%] w-[40%] rotate-[8deg] rounded-[28px] bg-gradient-to-r from-[#2e333d] to-[#1a1c24]" />
      <CrackLine left="35%" top="48%" width="30%" rotate={20} />
      <CrackLine left="42%" top="53%" width="28%" rotate={5} />
      <CrackLine left="34%" top="56%" width="30%" rotate={-10} />
      <CrackLine left="42%" top="60%" width="26%" rotate={-25} />
    </div>
  );
}

function CrackLine({
  left,
  top,
  width,
  rotate,
}: {
  left: string;
  top: string;
  width: string;
  rotate: number;
}) {
  return (
    <div
      className="absolute h-[1.5px] bg-white/10"
      style={{ left, top, width, transform: `rotate(${rotate}deg)` }}
    />
  );
}

function Bracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map: Record<typeof pos, string> = {
    tl: "top-0 left-0 border-t-[3px] border-l-[3px]",
    tr: "top-0 right-0 border-t-[3px] border-r-[3px]",
    bl: "bottom-0 left-0 border-b-[3px] border-l-[3px]",
    br: "bottom-0 right-0 border-b-[3px] border-r-[3px]",
  };
  return (
    <span
      aria-hidden
      className={`absolute h-7 w-7 border-white/85 ${map[pos]}`}
    />
  );
}

function ModeLabel({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`text-[11px] tracking-[0.08em] ${
        active
          ? "font-extrabold text-[#08f]"
          : "font-medium text-[#8c99a6]"
      }`}
    >
      {label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Icons
// ────────────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
}

function FlashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#08f" aria-hidden>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-white" aria-hidden>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 10a6.5 6.5 0 0 1 11.1-4.6L17 8" />
      <path d="M17 3.5V8h-4.5" />
      <path d="M16.5 10a6.5 6.5 0 0 1-11.1 4.6L3 12" />
      <path d="M3 16.5V12h4.5" />
    </svg>
  );
}
