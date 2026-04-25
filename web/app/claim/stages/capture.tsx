"use client";

// Snap-photo stage — third step of the claim flow. Mirrors Figma node 53:26
// (SC-03 · Snap photo) 1:1: vertical-gradient viewfinder with a tilted damaged
// rectangle, four white corner brackets, top controls (close / HDR / flash),
// a tip pill, and a bottom toolbar with mode tabs + lime SNAP shutter.
//
// The shutter only fires `onShutter`; the orchestrator opens the native
// camera via <input type="file" accept="image/*" capture="environment">.

import type { CSSProperties } from "react";

type Props = {
  /** Tap on the lime SNAP shutter — orchestrator opens the file/camera input. */
  onShutter: () => void;
  onBack: () => void;
  onClose: () => void;
  /** Optional category label, shown subtly above the tip pill. */
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
      className="snap relative h-[100dvh] w-full overflow-hidden bg-[#030304] text-white"
      style={{
        // Use safe-area insets so the toolbar/home-indicator sit correctly on
        // notched devices, while still anchoring to the Figma 402x874 layout.
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="relative mx-auto h-full w-full max-w-[402px]">
        {/* ──────────────────────────────────────────────────────────────
           Viewfinder — vertical gradient + decorative damaged shape
           ────────────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 overflow-hidden bg-gradient-to-b from-[#0d0f1a] via-[#1a2129] to-[#050609]"
          aria-hidden
        >
          {/* Tilted dark rounded rectangle — simulated damaged item */}
          <div
            className="absolute"
            style={{
              left: "66.46px",
              top: "247px",
              width: "222.784px",
              height: "341.937px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ transform: "rotate(8deg)" }}>
              <div className="h-[320px] w-[180px] rounded-[28px] bg-gradient-to-r from-[#2e333d] to-[#1a1c24]" />
            </div>
          </div>

          {/* Crack lines — thin diagonal strokes at 10% white */}
          <CrackLine left={120.49} top={337} width={113.276} rotate={20} />
          <CrackLine left={150.87} top={377} width={119.674} rotate={5} />
          <CrackLine left={121} top={396.16} width={118.437} rotate={-10} />
          <CrackLine left={151} top={406.29} width={109.391} rotate={-25} />

          {/* Four corner brackets — 28px arms, 3px thick, 85% opacity */}
          {/* top-left */}
          <span className="absolute h-[3px] w-[28px] bg-white opacity-85" style={{ left: 40, top: 200 }} />
          <span className="absolute h-[28px] w-[3px] bg-white opacity-85" style={{ left: 40, top: 200 }} />
          {/* top-right */}
          <span className="absolute h-[3px] w-[28px] bg-white opacity-85" style={{ left: 334, top: 200 }} />
          <span className="absolute h-[28px] w-[3px] bg-white opacity-85" style={{ left: 359, top: 200 }} />
          {/* bottom-left */}
          <span className="absolute h-[3px] w-[28px] bg-white opacity-85" style={{ left: 40, top: 617 }} />
          <span className="absolute h-[28px] w-[3px] bg-white opacity-85" style={{ left: 40, top: 592 }} />
          {/* bottom-right */}
          <span className="absolute h-[3px] w-[28px] bg-white opacity-85" style={{ left: 334, top: 617 }} />
          <span className="absolute h-[28px] w-[3px] bg-white opacity-85" style={{ left: 359, top: 592 }} />
        </div>

        {/* ──────────────────────────────────────────────────────────────
           Top controls — close / HDR / flash
           ────────────────────────────────────────────────────────────── */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(0,0,0,0.55)] text-white active:opacity-70"
          style={{ left: 16, top: 70, fontFamily: "'SF Pro Rounded', system-ui, sans-serif", fontWeight: 600, fontSize: 14 }}
        >
          {/* Back is the same gesture as close in this view (no separate back chevron in Figma) */}
          <span aria-hidden onDoubleClick={onBack}>✕</span>
        </button>

        <div
          className="absolute flex h-8 items-center justify-center rounded-2xl bg-[rgba(0,0,0,0.55)]"
          style={{ left: 171, top: 74, width: 60 }}
          aria-hidden
        >
          <span
            className="text-white"
            style={{
              fontFamily: "'SF Pro Rounded', system-ui, sans-serif",
              fontWeight: 900,
              fontSize: 11,
              letterSpacing: "0.04em",
            }}
          >
            HDR
          </span>
        </div>

        <button
          type="button"
          aria-label="Toggle flash"
          className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(0,0,0,0.55)] active:opacity-70"
          style={{ left: 346, top: 70 }}
        >
          <span
            style={{
              color: "#a8db45",
              fontFamily: "'SF Pro Rounded', system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ⚡
          </span>
        </button>

        {/* ──────────────────────────────────────────────────────────────
           Optional category label — subtle, above the tip pill
           ────────────────────────────────────────────────────────────── */}
        {categoryLabel ? (
          <div
            className="absolute left-0 right-0 flex justify-center"
            style={{ top: 614 }}
            aria-hidden
          >
            <span
              className="rounded-full bg-[rgba(0,0,0,0.45)] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#a8db45]"
              style={{ fontFamily: "'SF Pro Rounded', system-ui, sans-serif", fontWeight: 800 }}
            >
              {categoryLabel}
            </span>
          </div>
        ) : null}

        {/* Tip pill — lime dot + "Frame the damage clearly" */}
        <div
          className="absolute flex items-center gap-2 rounded-[18px] bg-[rgba(0,0,0,0.55)]"
          style={{ left: 71, top: 644, width: 260, height: 36, paddingLeft: 14 }}
        >
          <span className="block h-2 w-2 rounded-full bg-[#a8db45]" aria-hidden />
          <span
            className="text-white"
            style={{
              fontFamily: "'SF Pro Rounded', system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Frame the damage clearly
          </span>
        </div>

        {/* ──────────────────────────────────────────────────────────────
           Bottom toolbar — VIDEO / PHOTO / CLAIM tabs + shutter
           ────────────────────────────────────────────────────────────── */}
        <div
          className="absolute left-0 w-full bg-[rgba(0,0,0,0.55)]"
          style={{ top: 696, height: 132 }}
        >
          {/* Mode tabs */}
          <ModeLabel left={121} active={false} label="VIDEO" />
          <ModeLabel left={201} active={false} label="PHOTO" />
          <ModeLabel left={281} active label="CLAIM" />

          {/* Active dot under "CLAIM" */}
          <span
            className="absolute h-1 w-1 rounded-full bg-[#a8db45]"
            style={{ left: 279, top: 28 }}
            aria-hidden
          />

          {/* Library / gallery button */}
          <button
            type="button"
            aria-label="Open library"
            className="absolute flex items-center justify-center rounded-[12px] border border-[rgba(255,255,255,0.2)] bg-[#333842] active:opacity-70"
            style={{ left: 36, top: 56, width: 48, height: 48 }}
          >
            <GridIcon />
          </button>

          {/* Shutter — 82px white ring → 64px lime disc with SNAP label */}
          <button
            type="button"
            onClick={onShutter}
            aria-label="Take photo"
            className="absolute flex items-center justify-center rounded-full bg-white active:opacity-90"
            style={{ left: 160, top: 36, width: 82, height: 82 }}
          >
            <span
              className="flex items-center justify-center rounded-full bg-[#a8db45]"
              style={{ width: 64, height: 64 }}
            >
              <span
                style={{
                  fontFamily: "'SF Pro Rounded', system-ui, sans-serif",
                  fontWeight: 900,
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  color: "#05070a",
                }}
              >
                SNAP
              </span>
            </span>
          </button>

          {/* Flip-camera */}
          <button
            type="button"
            aria-label="Flip camera"
            className="absolute flex items-center justify-center rounded-full bg-[#333842] text-white active:opacity-70"
            style={{ left: 318, top: 56, width: 48, height: 48 }}
          >
            <FlipIcon />
          </button>
        </div>

        {/* Home-indicator decorative bar */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/90"
          style={{ bottom: 8, width: 144, height: 5 }}
          aria-hidden
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function CrackLine({
  left,
  top,
  width,
  rotate,
}: {
  left: number;
  top: number;
  width: number;
  rotate: number;
}) {
  const wrapStyle: CSSProperties = {
    position: "absolute",
    left,
    top,
    width,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  return (
    <div style={wrapStyle} aria-hidden>
      <div
        style={{
          transform: `rotate(${rotate}deg)`,
          width: 120,
          height: 1.5,
          background: "rgba(255,255,255,0.1)",
        }}
      />
    </div>
  );
}

function ModeLabel({
  left,
  active,
  label,
}: {
  left: number;
  active: boolean;
  label: string;
}) {
  return (
    <span
      className="absolute -translate-x-1/2 text-center"
      style={{
        left,
        top: 10,
        width: 80,
        fontFamily: "'SF Pro Rounded', system-ui, sans-serif",
        fontWeight: active ? 900 : 500,
        fontSize: 11,
        letterSpacing: "0.08em",
        color: active ? "#a8db45" : "#8c99a6",
      }}
    >
      {label}
    </span>
  );
}

function GridIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-white"
      aria-hidden
    >
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 10a6.5 6.5 0 0 1 11.1-4.6L17 8" />
      <path d="M17 3.5V8h-4.5" />
      <path d="M16.5 10a6.5 6.5 0 0 1-11.1 4.6L3 12" />
      <path d="M3 16.5V12h4.5" />
    </svg>
  );
}
