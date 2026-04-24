"use client";

// SnapClaim — iPhone-native, full-screen claim wizard.
//
// Eight stages, all rendered edge-to-edge with iOS safe-area handling. Visual
// language: dark ink + lime accent + Syne display, mirroring the Figma design.
// Voice/photo capture reuses the existing lib helpers so backend wiring stays
// the same as before.
//
// Stages:
//   intro          → Hi, I'm Finn.
//   category       → What happened?
//   capture        → black viewfinder + native camera
//   review         → "Good shot?" preview + retake
//   voice          → idle / recording / transcribing
//   confirm        → "Here's what I heard" — transcript review
//   analyzing      → "Give me a few seconds" — cycling backend steps
//   result         → approved / escalated / rejected verdict
//   error          → recoverable error with reset

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Waveform from "../chat/waveform";
import { submitClaim, type ClaimResponse, type Coverage } from "@/lib/claim";
import { formatEUR } from "@/lib/format";
import { classifyPhoto } from "@/lib/photo-classify";
import { createRecorder, transcribeBlob, type RecorderHandle } from "@/lib/voice";
import {
  cycleSubmitSteps,
  STEP_LABELS,
  STEP_SEQUENCE,
  STEP_SUBLABELS,
  type SubmitStep,
} from "./decision";

const MAX_RECORD_S = 20;

type Category = {
  id: string;
  label: string;
  sub: string;
  coverage: Coverage;
  /** Outline icon path for the category card. */
  icon: React.ReactNode;
};

const CATEGORIES: Category[] = [
  {
    id: "device",
    label: "Device damage",
    sub: "Phone, laptop, camera, headphones",
    coverage: "phone",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="2" width="12" height="20" rx="2.5" />
        <path d="M9 18h6" />
      </svg>
    ),
  },
  {
    id: "travel",
    label: "Travel delay",
    sub: "Flight delay, cancellation, missed connection",
    coverage: "travel",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 16l7-3 7 3 4-9-4 1-7-3-7 3z" />
      </svg>
    ),
  },
  {
    id: "luggage",
    label: "Lost luggage",
    sub: "Bag delayed, missing, or damaged",
    coverage: "travel",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="7" width="14" height="13" rx="2" />
        <path d="M9 7V4h6v3" />
      </svg>
    ),
  },
  {
    id: "other",
    label: "Something else",
    sub: "Tell me what happened, I'll figure it out",
    coverage: "default",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9.5a3 3 0 116 0c0 1.5-1.5 2-2.5 2.5s-1 1.5-1 1.5" />
        <path d="M11.5 17.5h.01" />
      </svg>
    ),
  },
];

type Stage =
  | { kind: "intro" }
  | { kind: "category" }
  | { kind: "capture"; category: Category }
  | { kind: "review"; category: Category; file: File; preview: string }
  | {
      kind: "voice";
      category: Category;
      file: File;
      preview: string;
    }
  | {
      kind: "voiceRecording";
      category: Category;
      file: File;
      preview: string;
      elapsed: number;
      stream: MediaStream | null;
    }
  | {
      kind: "voiceTranscribing";
      category: Category;
      file: File;
      preview: string;
      blob: Blob;
      duration: number;
    }
  | {
      kind: "confirm";
      category: Category;
      file: File;
      preview: string;
      transcript: string;
      duration: number;
    }
  | {
      kind: "analyzing";
      category: Category;
      file: File;
      transcript: string;
      step: SubmitStep;
    }
  | { kind: "result"; result: ClaimResponse }
  | { kind: "error"; error: string };

export default function ClaimWizard() {
  const [stage, setStage] = useState<Stage>({ kind: "intro" });

  // Refs that survive renders inside the same flow.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickerRef = useRef<{ cancel: () => void } | null>(null);

  // Revoke the preview object URL when the file changes / on unmount.
  useEffect(() => {
    return () => {
      const s = stageRef.current;
      if (s.kind === "review" || s.kind === "voice" || s.kind === "voiceRecording" || s.kind === "voiceTranscribing" || s.kind === "confirm") {
        URL.revokeObjectURL(s.preview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stageRef = useRef<Stage>(stage);
  stageRef.current = stage;

  // ─────────── handlers ───────────

  function pickCategory(category: Category) {
    setStage({ kind: "capture", category });
    // Open native camera as soon as the capture stage mounts.
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  function onPhotoChosen(file: File) {
    const s = stageRef.current;
    if (s.kind !== "capture" && s.kind !== "review") return;
    const category = s.category;
    // If we're replacing a photo, kill the old object URL.
    if (s.kind === "review") URL.revokeObjectURL(s.preview);
    const preview = URL.createObjectURL(file);
    setStage({ kind: "review", category, file, preview });
  }

  function retakePhoto() {
    if (stage.kind !== "review") return;
    URL.revokeObjectURL(stage.preview);
    setStage({ kind: "capture", category: stage.category });
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  function continueToVoice() {
    if (stage.kind !== "review") return;
    setStage({
      kind: "voice",
      category: stage.category,
      file: stage.file,
      preview: stage.preview,
    });
  }

  async function startVoice() {
    if (stage.kind !== "voice" && stage.kind !== "voiceRecording") return;
    const base = stage.kind === "voice" ? stage : null;
    if (!base) return;
    try {
      const recorder = createRecorder();
      recorderRef.current = recorder;
      await recorder.start();
      const stream = recorder.getStream();
      startedAtRef.current = Date.now();
      setStage({
        kind: "voiceRecording",
        category: base.category,
        file: base.file,
        preview: base.preview,
        elapsed: 0,
        stream,
      });
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        if (elapsed >= MAX_RECORD_S) {
          stopVoice();
        } else {
          setStage((s) =>
            s.kind === "voiceRecording" ? { ...s, elapsed } : s,
          );
        }
      }, 100) as unknown as number;
    } catch (err) {
      setStage({
        kind: "error",
        error:
          err instanceof Error
            ? err.name === "NotAllowedError"
              ? "Microphone permission denied. Enable it in Settings → Safari and try again."
              : err.message
            : String(err),
      });
    }
  }

  async function stopVoice() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const s = stageRef.current;
    if (s.kind !== "voiceRecording") return;
    try {
      const blob = await recorderRef.current!.stop();
      const duration = (Date.now() - startedAtRef.current) / 1000;
      setStage({
        kind: "voiceTranscribing",
        category: s.category,
        file: s.file,
        preview: s.preview,
        blob,
        duration,
      });
      const { text } = await transcribeBlob(blob);
      const transcript = text.trim();
      if (!transcript) {
        setStage({
          kind: "error",
          error: "Didn't catch that — try the voice step again.",
        });
        return;
      }
      setStage({
        kind: "confirm",
        category: s.category,
        file: s.file,
        preview: s.preview,
        transcript,
        duration,
      });
    } catch (err) {
      setStage({
        kind: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function cancelVoice() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.cancel();
    if (stage.kind === "voiceRecording") {
      setStage({
        kind: "voice",
        category: stage.category,
        file: stage.file,
        preview: stage.preview,
      });
    }
  }

  function rerecordVoice() {
    if (stage.kind !== "confirm") return;
    setStage({
      kind: "voice",
      category: stage.category,
      file: stage.file,
      preview: stage.preview,
    });
  }

  function submit() {
    if (stage.kind !== "confirm") return;
    const { category, file, transcript } = stage;
    setStage({
      kind: "analyzing",
      category,
      file,
      transcript,
      step: "reading_photo",
    });

    tickerRef.current = cycleSubmitSteps((step) =>
      setStage((s) => (s.kind === "analyzing" ? { ...s, step } : s)),
    );

    submitClaim({
      image: file,
      transcript,
      coverage: category.coverage,
    })
      .then((result) => {
        tickerRef.current?.cancel();
        setStage({ kind: "result", result });
      })
      .catch((err) => {
        tickerRef.current?.cancel();
        setStage({
          kind: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  function reset() {
    tickerRef.current?.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.cancel();
    setStage({ kind: "intro" });
  }

  // ─────────── render ───────────

  return (
    <div
      className="snap relative flex min-h-[100dvh] w-full flex-col overflow-hidden"
      style={{
        // Pad for the iPhone notch + home indicator. Inner screens claim
        // their own bottom space if they need it.
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <AnimatePresence mode="wait">
        <ScreenSwitch key={stage.kind} stage={stage}>
          {stage.kind === "intro" && <IntroScreen onStart={() => setStage({ kind: "category" })} />}

          {stage.kind === "category" && (
            <CategoryScreen
              onPick={pickCategory}
              onBack={() => setStage({ kind: "intro" })}
            />
          )}

          {stage.kind === "capture" && (
            <CaptureScreen
              category={stage.category}
              onTrigger={() => fileInputRef.current?.click()}
              onBack={() => setStage({ kind: "category" })}
            />
          )}

          {stage.kind === "review" && (
            <ReviewScreen
              category={stage.category}
              previewUrl={stage.preview}
              file={stage.file}
              onRetake={retakePhoto}
              onContinue={continueToVoice}
              onBack={() => setStage({ kind: "category" })}
            />
          )}

          {stage.kind === "voice" && (
            <VoiceScreen
              category={stage.category}
              state="idle"
              onStart={startVoice}
              onStop={() => {}}
              onCancel={() => {}}
              onBack={() =>
                setStage({
                  kind: "review",
                  category: stage.category,
                  file: stage.file,
                  preview: stage.preview,
                })
              }
              elapsed={0}
              stream={null}
            />
          )}

          {stage.kind === "voiceRecording" && (
            <VoiceScreen
              category={stage.category}
              state="recording"
              onStart={() => {}}
              onStop={stopVoice}
              onCancel={cancelVoice}
              onBack={cancelVoice}
              elapsed={stage.elapsed}
              stream={stage.stream}
            />
          )}

          {stage.kind === "voiceTranscribing" && (
            <VoiceScreen
              category={stage.category}
              state="transcribing"
              onStart={() => {}}
              onStop={() => {}}
              onCancel={() => {}}
              onBack={() => {}}
              elapsed={stage.duration}
              stream={null}
            />
          )}

          {stage.kind === "confirm" && (
            <ConfirmScreen
              category={stage.category}
              transcript={stage.transcript}
              onConfirm={submit}
              onRerecord={rerecordVoice}
              onBack={rerecordVoice}
            />
          )}

          {stage.kind === "analyzing" && <AnalyzingScreen step={stage.step} />}

          {stage.kind === "result" && (
            <ResultScreen result={stage.result} onAgain={reset} />
          )}

          {stage.kind === "error" && (
            <ErrorScreen error={stage.error} onReset={reset} />
          )}
        </ScreenSwitch>
      </AnimatePresence>

      {/* Hidden file input — driven by capture/review screens. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPhotoChosen(f);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Animated screen frame
// ════════════════════════════════════════════════════════════════════════════

function ScreenSwitch({
  children,
  stage,
}: {
  children: React.ReactNode;
  stage: Stage;
}) {
  // Slight horizontal slide for forward motion + fade. AnimatePresence keys
  // off `stage.kind`, so each kind change drives a fresh enter.
  void stage;
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22, ease: [0.2, 0.7, 0.3, 1] }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 1 · Intro
// ════════════════════════════════════════════════════════════════════════════

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-10">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--snap-border)] text-[var(--snap-text-soft)]"
        >
          <CloseIcon />
        </Link>
        <span className="snap-mono text-[10px] uppercase tracking-[0.14em] text-[var(--snap-text-muted)]">
          Claims · Finn
        </span>
        <span className="w-9" />
      </div>

      <div className="mt-12 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--snap-lime)] text-2xl font-extrabold text-[var(--snap-ink)]">
        F
      </div>

      <h1 className="mt-5 max-w-[16ch] text-balance font-display text-[44px] font-semibold leading-[1.05] tracking-tight">
        Hi, I&apos;m Finn.
        <br />
        Let&apos;s sort this out.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--snap-text-soft)]">
        It&apos;ll take you through three quick steps. Should take about a minute, and most claims
        get paid the moment we&apos;re done.
      </p>

      <ol className="mt-8 space-y-3.5">
        {[
          ["1", "Snap a photo", "Of the damaged item, delay board, or receipt"],
          ["2", "Tell me what happened", "A 20-second voice note — when, where, how"],
          ["3", "I do the rest", "Check your policy, match the purchase, pay if approved"],
        ].map(([n, t, sub]) => (
          <li key={n} className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--snap-lime-faint)] snap-mono text-[12px] font-medium text-[var(--snap-lime)]">
              {n}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium leading-tight">{t}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-[var(--snap-text-soft)]">{sub}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-auto pt-10">
        <PrimaryCTA onClick={onStart}>Start a claim</PrimaryCTA>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 2 · Category
// ════════════════════════════════════════════════════════════════════════════

function CategoryScreen({
  onPick,
  onBack,
}: {
  onPick: (c: Category) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
      <StepHeader step={1} total={3} title="What happened?" onBack={onBack} />
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--snap-text-soft)]">
        Pick the closest match — I use this to frame the right questions and check the right
        cover.
      </p>

      <div className="mt-7 space-y-2.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c)}
            className="group flex w-full items-center gap-4 rounded-2xl border border-[var(--snap-border)] bg-[var(--snap-surface)] px-4 py-4 text-left transition-colors active:bg-[var(--snap-surface-2)]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--snap-lime-faint)] text-[var(--snap-lime)]">
              <span className="block h-5 w-5">{c.icon}</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-medium leading-tight">{c.label}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--snap-text-soft)]">
                {c.sub}
              </span>
            </span>
            <ChevronRight />
          </button>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 3 · Capture (decorative viewfinder; native camera does the actual capture)
// ════════════════════════════════════════════════════════════════════════════

function CaptureScreen({
  category,
  onTrigger,
  onBack,
}: {
  category: Category;
  onTrigger: () => void;
  onBack: () => void;
}) {
  return (
    <div className="relative flex flex-1 flex-col bg-black">
      {/* Hatched backdrop + vignette so the empty viewfinder doesn't read as broken */}
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
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      <div className="relative flex items-center justify-between px-5 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
        >
          <ChevronLeft />
        </button>
        <span className="rounded-full bg-[var(--snap-lime)]/15 px-3 py-1 snap-mono text-[10px] uppercase tracking-[0.12em] text-[var(--snap-lime)] backdrop-blur">
          Step 2 of 3 · Snap the {category.id === "device" ? "damage" : "evidence"}
        </span>
        <span className="w-9" />
      </div>

      <div className="relative mx-4 mt-4 rounded-2xl border border-white/10 bg-black/65 px-3 py-2.5 backdrop-blur">
        <div className="flex items-start gap-2.5">
          <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--snap-lime)] text-[10px] font-extrabold text-[var(--snap-ink)]">
            F
          </div>
          <p className="text-[12px] leading-snug text-white">
            Fill the frame with the {category.id === "device" ? "damage" : "evidence"}. One clear
            shot is enough — I&apos;ll read the rest.
          </p>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-12">
        <div className="relative aspect-[3/4] w-full max-w-[300px]">
          <Bracket pos="tl" />
          <Bracket pos="tr" />
          <Bracket pos="bl" />
          <Bracket pos="br" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="snap-mono text-[10px] uppercase tracking-wider text-white/45">
              [ {category.id === "device" ? "damaged item" : "evidence"} in frame ]
            </span>
          </div>
        </div>
      </div>

      <div className="relative mb-2 flex justify-center">
        <span className="rounded-xl bg-black/55 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur">
          Hold steady · Fill the frame · Good light
        </span>
      </div>

      <div className="relative flex items-center justify-center gap-12 px-8 pb-8 pt-4">
        <span className="w-12" />
        <button
          type="button"
          onClick={onTrigger}
          aria-label="Take photo"
          className="flex h-[78px] w-[78px] items-center justify-center rounded-full border-[3px] border-white bg-white/10 active:scale-95"
        >
          <span className="h-[60px] w-[60px] rounded-full bg-[var(--snap-lime)]" />
        </button>
        <span className="w-12" />
      </div>
    </div>
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
      className={`absolute h-7 w-7 border-[var(--snap-lime)] ${map[pos]}`}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 4 · Review photo
// ════════════════════════════════════════════════════════════════════════════

function ReviewScreen({
  category,
  previewUrl,
  file,
  onRetake,
  onContinue,
  onBack,
}: {
  category: Category;
  previewUrl: string;
  file: File;
  onRetake: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
      <StepHeader step={2} total={3} title="Review · photo" onBack={onBack} />

      <h2 className="mt-4 font-display text-[28px] font-semibold leading-tight tracking-tight">
        Good shot?
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--snap-text-soft)]">
        I&apos;ll read the {category.id === "device" ? "damage" : "evidence"} from this photo. If
        it&apos;s blurry or partial, retake now — saves us both time.
      </p>

      <div className="relative mt-5 overflow-hidden rounded-2xl border border-[var(--snap-border)] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Captured evidence"
          className="block w-full max-h-[58vh] object-cover"
        />
        <div className="absolute left-3 top-3">
          <span className="rounded-lg bg-black/65 px-2.5 py-1 snap-mono text-[10px] text-white backdrop-blur">
            {file.name.length > 24 ? file.name.slice(0, 22) + "…" : file.name} · {formatBytes(file.size)}
          </span>
        </div>
      </div>

      <div className="mt-auto space-y-2 pt-6">
        <PrimaryCTA onClick={onContinue}>Looks good · voice note</PrimaryCTA>
        <SecondaryCTA onClick={onRetake}>Retake</SecondaryCTA>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 5 · Voice (idle / recording / transcribing)
// ════════════════════════════════════════════════════════════════════════════

function VoiceScreen({
  category,
  state,
  onStart,
  onStop,
  onCancel,
  onBack,
  elapsed,
  stream,
}: {
  category: Category;
  state: "idle" | "recording" | "transcribing";
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onBack: () => void;
  elapsed: number;
  stream: MediaStream | null;
}) {
  const remaining = Math.max(0, MAX_RECORD_S - elapsed);
  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
      <StepHeader
        step={3}
        total={3}
        title={state === "transcribing" ? "Transcribing" : "Voice note"}
        onBack={state === "idle" ? onBack : onCancel}
        backLabel={state === "recording" ? "Cancel" : "Back"}
      />

      <h2 className="mt-4 font-display text-[28px] font-semibold leading-tight tracking-tight">
        {state === "idle" && "Tell me what happened."}
        {state === "recording" && "Listening…"}
        {state === "transcribing" && "Reading you back…"}
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--snap-text-soft)]">
        {state === "idle" &&
          (category.id === "travel" || category.id === "luggage"
            ? "Where, when, how long — natural speech, no forms."
            : "When, where, and how it happened — and what it cost.")}
        {state === "recording" && "Up to 20 seconds. Tap stop when you&apos;re done."}
        {state === "transcribing" && "One second — pulling out the facts."}
      </p>

      <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
        <div className="snap-mono text-[64px] font-light leading-none tabular-nums tracking-tight">
          {formatTime(state === "idle" ? 0 : elapsed)}
        </div>
        <div className="mt-2 snap-mono text-[10px] uppercase tracking-[0.14em] text-[var(--snap-text-muted)]">
          {state === "idle"
            ? "Up to 20 seconds"
            : state === "recording"
              ? `${Math.round(remaining)}s remaining`
              : "Sit tight"}
        </div>

        <div className="mt-8 h-12 w-full max-w-[280px]">
          <Waveform
            stream={stream}
            barClassName={
              state === "recording"
                ? "bg-[var(--snap-lime)]"
                : "bg-[var(--snap-text-muted)]/60"
            }
            bars={32}
          />
        </div>

        <div className="mt-12">
          {state === "idle" && (
            <button
              type="button"
              onClick={onStart}
              aria-label="Start recording"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--snap-lime)] active:scale-95 transition-transform"
            >
              <MicGlyph color="var(--snap-ink)" />
            </button>
          )}
          {state === "recording" && (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop recording"
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--snap-lime)] active:scale-95 transition-transform"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--snap-lime)]/30" />
              <span className="relative h-7 w-7 rounded-md bg-[var(--snap-ink)]" />
            </button>
          )}
          {state === "transcribing" && (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[var(--snap-lime)]/30">
              <Spinner color="var(--snap-lime)" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 6 · Confirm transcript
// ════════════════════════════════════════════════════════════════════════════

function ConfirmScreen({
  category,
  transcript,
  onConfirm,
  onRerecord,
  onBack,
}: {
  category: Category;
  transcript: string;
  onConfirm: () => void;
  onRerecord: () => void;
  onBack: () => void;
}) {
  void category;
  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
      <StepHeader step={3} total={3} title="Here's what I heard" onBack={onBack} />

      <h2 className="mt-4 font-display text-[28px] font-semibold leading-tight tracking-tight">
        Sound right?
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--snap-text-soft)]">
        If anything&apos;s off, re-record. Otherwise tap confirm and I&apos;ll work the rest.
      </p>

      <div className="mt-6 rounded-2xl border border-[var(--snap-border)] bg-[var(--snap-surface)] p-4">
        <div className="flex items-start gap-2.5">
          <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--snap-lime)] text-[10px] font-extrabold text-[var(--snap-ink)]">
            F
          </div>
          <p className="text-[15px] leading-relaxed text-[var(--snap-text)]">
            &ldquo;{transcript}&rdquo;
          </p>
        </div>
      </div>

      <div className="mt-auto space-y-2 pt-6">
        <PrimaryCTA onClick={onConfirm}>Sounds right · analyze</PrimaryCTA>
        <SecondaryCTA onClick={onRerecord}>Re-record</SecondaryCTA>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 7 · Analyzing
// ════════════════════════════════════════════════════════════════════════════

function AnalyzingScreen({ step }: { step: SubmitStep }) {
  const currentIdx = STEP_SEQUENCE.indexOf(step);
  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-12">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--snap-lime)] text-2xl font-extrabold text-[var(--snap-ink)]">
          F
        </div>
        <h2 className="mt-5 font-display text-[28px] font-semibold leading-tight tracking-tight">
          Give me a few seconds.
        </h2>
        <p className="mt-2 max-w-[28ch] text-[14px] leading-relaxed text-[var(--snap-text-soft)]">
          I&apos;m running a few checks in parallel — usually about{" "}
          <span className="text-[var(--snap-text)]">8 seconds</span>.
        </p>
      </div>

      <ol className="mt-10 space-y-3">
        {STEP_SEQUENCE.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const dim = !done && !active;
          return (
            <li
              key={s}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
                active
                  ? "border-[var(--snap-lime-border)] bg-[var(--snap-lime-faint)]"
                  : "border-[var(--snap-border)] bg-[var(--snap-surface)]"
              } ${dim ? "opacity-50" : ""}`}
            >
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  done ? "bg-[var(--snap-lime)]" : active ? "bg-[var(--snap-lime)] animate-pulse" : "bg-[var(--snap-text-muted)]"
                }`}
              />
              <div className="min-w-0">
                <p className="text-[14px] font-medium leading-tight">{STEP_LABELS[s]}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-[var(--snap-text-soft)]">
                  {STEP_SUBLABELS[s]}
                </p>
              </div>
              {done && (
                <span className="ml-auto text-[var(--snap-lime)]">
                  <CheckIcon />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 8 · Result (approved / escalated / rejected)
// ════════════════════════════════════════════════════════════════════════════

function ResultScreen({
  result,
  onAgain,
}: {
  result: ClaimResponse;
  onAgain: () => void;
}) {
  const { decision } = result;
  const tone =
    decision.decision === "approve"
      ? "approved"
      : decision.decision === "escalate"
        ? "escalated"
        : "rejected";

  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-6">
      <StepHeader title="Done" onBack={onAgain} backLabel="New" />

      <div className="mt-6">
        <ResultPill tone={tone} />
      </div>

      {tone === "approved" ? (
        <>
          <p className="mt-6 snap-mono text-[10px] uppercase tracking-[0.14em] text-[var(--snap-text-muted)]">
            Paid to your bunq account
          </p>
          <p className="mt-2 font-display text-[64px] font-semibold leading-none tabular-nums tracking-tight text-[var(--snap-text)]">
            {formatEUR(decision.payout_eur || decision.claim_amount_eur)}
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--snap-text-soft)]">
            {decision.reason}
          </p>
        </>
      ) : tone === "escalated" ? (
        <>
          <h2 className="mt-6 font-display text-[32px] font-semibold leading-tight tracking-tight">
            A specialist is picking this up.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--snap-text-soft)]">
            {decision.reason}
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-6 font-display text-[32px] font-semibold leading-tight tracking-tight">
            This isn&apos;t covered.
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--snap-text-soft)]">
            {decision.reason}
          </p>
        </>
      )}

      <div className="mt-7 space-y-3">
        <MetaRow k="Damage" v={`${decision.damage_type} · ${decision.severity}`} />
        <MetaRow k="Claim amount" v={formatEUR(decision.claim_amount_eur)} />
        {decision.deductible_eur ? (
          <MetaRow k="Deductible" v={`-${formatEUR(decision.deductible_eur)}`} />
        ) : null}
        <MetaRow k="Confidence" v={`${Math.round(decision.confidence * 100)}%`} />
        {decision.matched_payment_id ? (
          <MetaRow k="Matched payment" v={`#${decision.matched_payment_id}`} />
        ) : null}
        {decision.policy_clause && (
          <MetaRow k="Policy clause" v={decision.policy_clause} />
        )}
      </div>

      <div className="mt-auto space-y-2 pt-8">
        <PrimaryCTA onClick={onAgain}>
          {tone === "approved" ? "Done" : "File another"}
        </PrimaryCTA>
      </div>
    </div>
  );
}

function ResultPill({ tone }: { tone: "approved" | "escalated" | "rejected" }) {
  const map = {
    approved: { label: "Approved · paid", color: "var(--snap-lime)", border: "var(--snap-lime-border)", bg: "var(--snap-lime-faint)" },
    escalated: { label: "Needs a human look", color: "var(--snap-amber)", border: "rgba(255,179,64,0.3)", bg: "rgba(255,179,64,0.08)" },
    rejected: { label: "Can't cover this one", color: "var(--snap-red)", border: "rgba(255,107,107,0.3)", bg: "rgba(255,107,107,0.08)" },
  } as const;
  const t = map[tone];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 snap-mono text-[10px] uppercase tracking-[0.14em]"
      style={{ color: t.color, borderColor: t.border, background: t.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
      {t.label}
    </span>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--snap-border)] pb-2.5">
      <span className="text-[13px] text-[var(--snap-text-muted)]">{k}</span>
      <span className="text-right text-[14px] tabular-nums text-[var(--snap-text)]">{v}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Error
// ════════════════════════════════════════════════════════════════════════════

function ErrorScreen({ error, onReset }: { error: string; onReset: () => void }) {
  return (
    <div className="flex flex-1 flex-col px-6 pb-8 pt-12">
      <ResultPill tone="rejected" />
      <h2 className="mt-6 font-display text-[28px] font-semibold leading-tight tracking-tight">
        Something tripped me up.
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--snap-text-soft)]">{error}</p>
      <div className="mt-auto pt-8">
        <PrimaryCTA onClick={onReset}>Try again</PrimaryCTA>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Shared bits
// ════════════════════════════════════════════════════════════════════════════

function StepHeader({
  step,
  total,
  title,
  onBack,
  backLabel = "Back",
}: {
  step?: number;
  total?: number;
  title: string;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="-ml-2 flex h-9 items-center gap-1.5 rounded-full px-2 text-[var(--snap-text-soft)] active:bg-[var(--snap-surface)]"
      >
        <ChevronLeft />
        <span className="snap-mono text-[10px] uppercase tracking-[0.14em]">{backLabel}</span>
      </button>
      <span className="snap-mono text-[10px] uppercase tracking-[0.14em] text-[var(--snap-text-muted)]">
        {step && total ? `Step ${step} of ${total} · ` : ""}
        {title}
      </span>
      <span className="w-9" />
    </div>
  );
}

function PrimaryCTA({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--snap-lime)] text-[16px] font-bold tracking-tight text-[var(--snap-ink)] active:scale-[0.98] transition-transform"
    >
      {children}
      <ArrowRight />
    </button>
  );
}

function SecondaryCTA({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center rounded-2xl border border-[var(--snap-border)] bg-[var(--snap-surface)] text-[14px] font-medium text-[var(--snap-text)] active:bg-[var(--snap-surface-2)]"
    >
      {children}
    </button>
  );
}

// ─────────── icons + helpers ───────────

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 2L3.5 7 9 12" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--snap-text-muted)]" aria-hidden>
      <path d="M5 2l5.5 5L5 12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9h10M10 5l4 4-4 4" />
    </svg>
  );
}

function MicGlyph({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5L6.5 12 13 4.5" />
    </svg>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// `classifyPhoto` lives in lib/photo-classify but isn't currently used by the
// dedicated wizard — chat already does cross-routing. Imported above for
// future use; reference here keeps the dead-code linter quiet.
void classifyPhoto;
