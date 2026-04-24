"use client";

// PhotoUpload — two-state photo input matching SnapClaim screens 03 + 04.
//
// Empty state (Screen 03 · Capture):
//   Full-bleed dark canvas with corner brackets and a Finn guidance bubble.
//   Tapping the lime capture button opens the native camera on mobile (via
//   capture="environment") and the file picker on desktop. The decorative
//   viewfinder is intentional — building a real WebRTC viewfinder is a
//   week of edge-case handling for no demo win.
//
// Review state (Screen 04 · Review):
//   The captured photo + a mono metadata chip (filename · size) and a
//   Retake button. Compressed in the browser before being handed up.
//
// Contract: parent owns the File (or null). All state derives from `value`.

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { compressImage, formatBytes } from "@/lib/compress";
import { FinnBubble } from "./ui/FinnBubble";
import { Pill, PillDot } from "./ui/Pill";

type Props = {
  value: File | null;
  onChange: (file: File | null) => void;
  /** Step indicator copy — defaults match the SnapClaim flow. */
  step?: { current: number; total: number; label?: string };
};

export function PhotoUpload({
  value,
  onChange,
  step = { current: 3, total: 6, label: "Snap the damage" },
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Object URL lifecycle — revoke when the file changes or unmounts.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const openPicker = () => inputRef.current?.click();

  const handleFile = async (file: File | null) => {
    if (!file) {
      onChange(null);
      return;
    }
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <AnimatePresence mode="wait">
        {value && previewUrl ? (
          <ReviewState
            key="review"
            file={value}
            previewUrl={previewUrl}
            onRetake={() => {
              onChange(null);
              // Reset the input so picking the *same* file again still fires onChange.
              if (inputRef.current) inputRef.current.value = "";
              openPicker();
            }}
            onClear={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        ) : (
          <CaptureState
            key="capture"
            step={step}
            busy={busy}
            onCapture={openPicker}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Capture state — Screen 03

function CaptureState({
  step,
  busy,
  onCapture,
}: {
  step: { current: number; total: number; label?: string };
  busy: boolean;
  onCapture: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative h-full min-h-[560px] w-full overflow-hidden rounded-card bg-black"
    >
      {/* Hatched backdrop — keeps the empty state visually rich without a real camera feed */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #0a0a0a 0 12px, #141414 12px 24px)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)",
        }}
      />

      {/* Top: step pill */}
      <div className="absolute inset-x-0 top-3 flex items-center justify-center px-5">
        <Pill tone="lime" className="bg-lime/15 backdrop-blur">
          <PillDot tone="lime" />
          Step {step.current} of {step.total}
          {step.label && <span> · {step.label}</span>}
        </Pill>
      </div>

      {/* Finn guidance */}
      <div className="absolute inset-x-4 top-14">
        <div className="rounded-xl border border-white/10 bg-black/65 px-3 py-2.5 backdrop-blur">
          <div className="flex items-start gap-2.5">
            <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-lime text-[10px] font-extrabold text-ink">
              F
            </div>
            <p className="text-[11.5px] leading-relaxed text-white">
              Fill the frame with the damage. I&apos;ll read the crack pattern,
              model, and depth. One clear shot is enough.
            </p>
          </div>
        </div>
      </div>

      {/* Corner brackets — the viewfinder */}
      <div className="absolute bottom-[34%] left-[12%] right-[12%] top-[30%]">
        <Bracket pos="tl" />
        <Bracket pos="tr" />
        <Bracket pos="bl" />
        <Bracket pos="br" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">
            [ damaged item in frame ]
          </span>
        </div>
      </div>

      {/* Tip line */}
      <div className="absolute inset-x-5 top-[72%] text-center">
        <span className="inline-block rounded-xl bg-black/55 px-3.5 py-2 text-[11.5px] font-medium text-white backdrop-blur">
          Hold steady · Fill frame · Good lighting
        </span>
      </div>

      {/* Bottom: capture button */}
      <div className="absolute inset-x-0 bottom-8 flex items-center justify-center px-8">
        <button
          type="button"
          onClick={onCapture}
          disabled={busy}
          aria-label="Capture photo"
          className={cn(
            "flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-white bg-white/10 transition active:scale-95",
            busy && "opacity-60",
          )}
        >
          <span
            className={cn(
              "h-[58px] w-[58px] rounded-full bg-lime transition",
              busy && "animate-pulse",
            )}
          />
        </button>
      </div>
    </motion.div>
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
    <div
      aria-hidden
      className={cn("absolute h-7 w-7 border-lime", map[pos])}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Review state — Screen 04

function ReviewState({
  file,
  previewUrl,
  onRetake,
  onClear,
}: {
  file: File;
  previewUrl: string;
  onRetake: () => void;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22 }}
      className="space-y-3"
    >
      <div>
        <h2 className="text-[24px] font-extrabold leading-tight tracking-tightest">
          Good shot?
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-soft">
          I&apos;ll analyze the damage from this photo in a second. If
          it&apos;s blurry or partial, retake now — saves us both time.
        </p>
      </div>

      <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-subtle bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Captured damage"
          className="h-full w-full object-cover"
        />
        <div className="absolute left-3 top-3">
          <span className="rounded-lg bg-black/65 px-2.5 py-1 font-mono text-[10px] text-white backdrop-blur">
            {file.name} · {formatBytes(file.size)}
          </span>
        </div>
      </div>

      <FinnBubble>
        <span className="font-semibold">Next up:</span> a 20-second voice note.
        Tell me <span className="text-lime">when</span>,{" "}
        <span className="text-lime">where</span>, and{" "}
        <span className="text-lime">how</span> it happened — natural speech,
        no forms.
      </FinnBubble>

      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onRetake}
          className="flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-subtle bg-white/[0.05] text-[12.5px] font-semibold text-text active:scale-[0.98]"
        >
          <RetakeIcon /> Retake
        </button>
        <button
          type="button"
          onClick={onClear}
          className="flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-subtle bg-white/[0.05] text-[12.5px] font-semibold text-text active:scale-[0.98]"
        >
          <RemoveIcon /> Remove
        </button>
      </div>
    </motion.div>
  );
}

function RetakeIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 7a5 5 0 019-3l1 1M12 7a5 5 0 01-9 3l-1-1M12 2v3H9M2 12V9h3" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}
