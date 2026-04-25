"use client";

// Finn — iPhone-native, full-screen claim wizard.
//
// Visual language follows the Finn-Insurance Figma 1:1: dark `--finn-bg`
// canvas, `--finn-card` surfaces, bunq-blue (`--finn-blue`) primary CTAs,
// real Finn avatar PNGs, and a six-segment progress bar above every screen.
//
// Stages map to Figma frames:
//   intro     → 02 Finn Intro       — three-step explainer
//   category  → 03 Category         — radio-list with Continue CTA
//   capture   → native iPhone camera (no Figma frame; trigger only)
//   review    → 05 Review Photo     — preview + Retake / Add another
//   voice     → 06 Voice Note       — recorder + suggested topics
//   confirm   → "Here's what I heard" review (post-transcribe)
//   analyzing → 06 Finn is Working  — six-step checklist
//   result    → 06 Payout Confirmed — amount card + meta + Done CTA
//
// The state machine + handlers are unchanged; only the visual layer was
// rebuilt against the Figma. Backend wiring (submitClaim, transcribeBlob,
// recorder helpers) is identical to the previous wizard.

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Waveform from "../chat/waveform";
import { submitClaim, type ClaimResponse, type Coverage } from "@/lib/claim";
import { formatEUR } from "@/lib/format";
import { classifyPhoto, type ClassifyResult } from "@/lib/photo-classify";
import { createRecorder, transcribeBlob, type RecorderHandle } from "@/lib/voice";
import {
  cycleSubmitSteps,
  STEP_LABELS,
  STEP_SEQUENCE,
  STEP_SUBLABELS,
  type SubmitStep,
} from "./decision";

const MAX_RECORD_S = 20;
const TOTAL_STEPS = 6; // matches Figma "1/6 … 6/6" header indicator

type Category = {
  id: "device" | "travel" | "medical" | "luggage" | "other";
  label: string;
  sub: string;
  coverage: Coverage;
};

const CATEGORIES: Category[] = [
  { id: "device", label: "Device Damage", sub: "Phone screen, laptop, camera..", coverage: "phone" },
  { id: "travel", label: "Travel Delay", sub: "If the flight or train got cancelled", coverage: "travel" },
  { id: "medical", label: "Medical Care", sub: "Bill, ambulance, hospital...", coverage: "default" },
  { id: "luggage", label: "Lost Luggage", sub: "Delayed, stolen, or misrouted bags", coverage: "travel" },
  { id: "other", label: "Something Else", sub: "Describe what happened. I will try to help", coverage: "default" },
];

type Stage =
  | { kind: "intro" }
  | { kind: "category"; selected: Category | null }
  | { kind: "capture"; category: Category }
  | {
      kind: "review";
      category: Category;
      file: File;
      preview: string;
      classification: ClassifyResult | null;
    }
  | {
      kind: "voice";
      category: Category;
      file: File;
      preview: string;
      classification: ClassifyResult | null;
    }
  | {
      kind: "voiceRecording";
      category: Category;
      file: File;
      preview: string;
      classification: ClassifyResult | null;
      elapsed: number;
      stream: MediaStream | null;
    }
  | {
      kind: "voiceTranscribing";
      category: Category;
      file: File;
      preview: string;
      classification: ClassifyResult | null;
      blob: Blob;
      duration: number;
    }
  | {
      kind: "confirm";
      category: Category;
      file: File;
      preview: string;
      classification: ClassifyResult | null;
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

/** Map a stage to its 1-indexed slot in the 6-step progress bar. */
function progressFor(stage: Stage): number {
  switch (stage.kind) {
    case "intro":
      return 1;
    case "category":
      return 2;
    case "capture":
    case "review":
      return 3;
    case "voice":
    case "voiceRecording":
    case "voiceTranscribing":
    case "confirm":
      return 4;
    case "analyzing":
      return 5;
    case "result":
    case "error":
      return 6;
  }
}

const SECTION_LABELS: Record<Stage["kind"], string> = {
  intro: "Introduction",
  category: "Category",
  capture: "Photo",
  review: "Review Photo",
  voice: "Voice Note",
  voiceRecording: "Voice Note",
  voiceTranscribing: "Voice Note",
  confirm: "Review Note",
  analyzing: "Finn is Working",
  result: "Done",
  error: "Something tripped me up",
};

export default function ClaimWizard() {
  const [stage, setStage] = useState<Stage>({ kind: "intro" });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickerRef = useRef<{ cancel: () => void } | null>(null);

  const stageRef = useRef<Stage>(stage);
  stageRef.current = stage;

  // Revoke any preview blob URL on unmount.
  useEffect(() => {
    return () => {
      const s = stageRef.current;
      if (
        s.kind === "review" ||
        s.kind === "voice" ||
        s.kind === "voiceRecording" ||
        s.kind === "voiceTranscribing" ||
        s.kind === "confirm"
      ) {
        URL.revokeObjectURL(s.preview);
      }
    };
  }, []);

  // ─────────── handlers ───────────

  function startCategory() {
    setStage({ kind: "category", selected: null });
  }

  function selectCategory(c: Category) {
    setStage((s) => (s.kind === "category" ? { ...s, selected: c } : s));
  }

  function continueFromCategory() {
    if (stage.kind !== "category" || !stage.selected) return;
    const category = stage.selected;
    setStage({ kind: "capture", category });
    // open native camera as soon as capture mounts
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  function onPhotoChosen(file: File) {
    const s = stageRef.current;
    if (s.kind !== "capture" && s.kind !== "review") return;
    const category = s.category;
    if (s.kind === "review") URL.revokeObjectURL(s.preview);
    const preview = URL.createObjectURL(file);
    setStage({ kind: "review", category, file, preview, classification: null });

    // Classify in the background so the Review screen's pill can label what
    // Finn actually sees (e.g. "iPhone — cracked screen") instead of the
    // hardcoded placeholder. Failures are silent — pill just falls back to a
    // generic label.
    classifyPhoto(file)
      .then((classification) => {
        setStage((cur) =>
          cur.kind === "review" && cur.file === file
            ? { ...cur, classification }
            : cur,
        );
      })
      .catch(() => {});
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
      classification: stage.classification,
    });
  }

  async function startVoice() {
    if (stage.kind !== "voice") return;
    const base = stage;
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
        classification: base.classification,
        elapsed: 0,
        stream,
      });
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        if (elapsed >= MAX_RECORD_S) {
          stopVoice();
        } else {
          setStage((s) => (s.kind === "voiceRecording" ? { ...s, elapsed } : s));
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
        classification: s.classification,
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
        classification: s.classification,
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
        classification: stage.classification,
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
      classification: stage.classification,
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

    submitClaim({ image: file, transcript, coverage: category.coverage })
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

  function backOneStep() {
    switch (stage.kind) {
      case "intro":
        return; // already at start
      case "category":
        setStage({ kind: "intro" });
        return;
      case "capture":
      case "review":
        setStage({ kind: "category", selected: stage.category });
        return;
      case "voice":
        setStage({
          kind: "review",
          category: stage.category,
          file: stage.file,
          preview: stage.preview,
          classification: stage.classification,
        });
        return;
      case "voiceRecording":
      case "voiceTranscribing":
        cancelVoice();
        return;
      case "confirm":
        rerecordVoice();
        return;
      case "analyzing":
      case "result":
      case "error":
        reset();
        return;
    }
  }

  // ─────────── render ───────────

  return (
    <div className="snap relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[var(--finn-bg)]">
      <AnimatePresence mode="wait">
        <ScreenSwitch key={stage.kind}>
          {stage.kind !== "result" && stage.kind !== "error" && (
            <WizardChrome
              section={SECTION_LABELS[stage.kind]}
              progress={progressFor(stage)}
              onBack={backOneStep}
            />
          )}

          {stage.kind === "intro" && <IntroScreen onStart={startCategory} />}

          {stage.kind === "category" && (
            <CategoryScreen
              selected={stage.selected}
              onSelect={selectCategory}
              onContinue={continueFromCategory}
            />
          )}

          {stage.kind === "capture" && (
            <CaptureScreen
              category={stage.category}
              onTrigger={() => fileInputRef.current?.click()}
            />
          )}

          {stage.kind === "review" && (
            <ReviewScreen
              category={stage.category}
              previewUrl={stage.preview}
              classification={stage.classification}
              onRetake={retakePhoto}
              onContinue={continueToVoice}
            />
          )}

          {stage.kind === "voice" && (
            <VoiceScreen state="idle" onStart={startVoice} onStop={() => {}} elapsed={0} stream={null} />
          )}

          {stage.kind === "voiceRecording" && (
            <VoiceScreen
              state="recording"
              onStart={() => {}}
              onStop={stopVoice}
              elapsed={stage.elapsed}
              stream={stage.stream}
            />
          )}

          {stage.kind === "voiceTranscribing" && (
            <VoiceScreen
              state="transcribing"
              onStart={() => {}}
              onStop={() => {}}
              elapsed={stage.duration}
              stream={null}
            />
          )}

          {stage.kind === "confirm" && (
            <ConfirmScreen
              transcript={stage.transcript}
              onConfirm={submit}
              onRerecord={rerecordVoice}
            />
          )}

          {stage.kind === "analyzing" && <AnalyzingScreen step={stage.step} />}

          {stage.kind === "result" && <ResultScreen result={stage.result} onAgain={reset} />}

          {stage.kind === "error" && <ErrorScreen error={stage.error} onReset={reset} />}
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
// Screen-switch animation
// ════════════════════════════════════════════════════════════════════════════

function ScreenSwitch({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22, ease: [0.2, 0.7, 0.3, 1] }}
      className="flex flex-1 flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {children}
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Top chrome — back · section label · X/6 · 6-segment progress
// ════════════════════════════════════════════════════════════════════════════

function WizardChrome({
  section,
  progress,
  onBack,
}: {
  section: string;
  progress: number;
  onBack: () => void;
}) {
  return (
    <div className="px-[18px] pt-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex items-center gap-2 active:opacity-60 transition-opacity"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1c1c1e]">
            <ChevronLeft />
          </span>
          <span className="text-[13px] font-semibold leading-[15px] text-[var(--finn-muted)]">
            {section}
          </span>
        </button>
        <span className="text-[13px] font-semibold tabular-nums text-[var(--finn-muted)]">
          {progress}/{TOTAL_STEPS}
        </span>
      </div>

      <ProgressBar value={progress} total={TOTAL_STEPS} />
    </div>
  );
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  return (
    <div className="mt-3 flex gap-[5px]">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-[3px] flex-1 rounded-full ${
            i < value ? "bg-[var(--finn-blue)]" : "bg-[#1c1c1e]"
          }`}
        />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 1 · Intro
// ════════════════════════════════════════════════════════════════════════════

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col px-[18px] pb-6 pt-5">
      <FinnAvatar variant="neutral" />

      <h1 className="mt-5 text-[34px] font-extrabold leading-[36px] tracking-tight text-balance text-[var(--finn-text)]">
        Hi, I&apos;m Finn.
        <br />
        Let&apos;s sort this out.
      </h1>

      <p className="mt-3 text-[13px] leading-[15px] text-[var(--finn-muted)]">
        I&apos;ll walk you through{" "}
        <span className="font-extrabold text-[var(--finn-text)]">three quick steps.</span>{" "}
        Should take about a minute, and most claims get paid the moment we&apos;re done.
      </p>

      <ul className="mt-5 space-y-3">
        {[
          { n: 1, t: "Snap a photo", s: "Of the damaged item, delay board, or receipt" },
          { n: 2, t: "Tell me what happened", s: "A 20-second voice note — when, where, how" },
          { n: 3, t: "I do the rest", s: "Check your policy, match the purchase, pay out" },
        ].map((row) => (
          <li key={row.n} className="flex items-center gap-2">
            <NumberedBadge n={row.n} />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-[var(--finn-text)]">{row.t}</p>
              <p className="text-[13px] leading-[15px] text-[var(--finn-muted)]">{row.s}</p>
            </div>
          </li>
        ))}
      </ul>

      <InfoCard className="mt-5">
        Your Easy Device + Travel cover is active. I&apos;ll never ask for info you&apos;ve already
        given me.
      </InfoCard>

      <div className="mt-auto pt-6">
        <BottomCTA caption="You can always edit or cancel later" onClick={onStart}>
          Pick category
        </BottomCTA>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 2 · Category
// ════════════════════════════════════════════════════════════════════════════

function CategoryScreen({
  selected,
  onSelect,
  onContinue,
}: {
  selected: Category | null;
  onSelect: (c: Category) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-[18px] pb-6 pt-5">
      <FinnAvatar variant="neutral" />

      <h1 className="mt-5 text-[34px] font-extrabold leading-[36px] tracking-tight text-balance text-[var(--finn-text)]">
        What kind of mishap do you want to report?
      </h1>

      <p className="mt-3 text-[13px] leading-[15px] text-[var(--finn-muted)]">
        Pick the closest match. I use this to frame the right questions. You can add nuance in your
        voice note in the next step.
      </p>

      <ul className="mt-4 overflow-hidden rounded-[16px] bg-[var(--finn-card)] p-2">
        {CATEGORIES.map((c, i) => {
          const isSel = selected?.id === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className={`flex w-full items-center gap-3 px-2 pb-3 pt-2.5 text-left active:opacity-70 transition-opacity ${
                  i < CATEGORIES.length - 1 ? "border-b border-[var(--finn-separator)]" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-[var(--finn-text)]">{c.label}</p>
                  <p className="mt-0.5 text-[13px] leading-[15px] text-[var(--finn-muted)]">
                    {c.sub}
                  </p>
                </div>
                <Radio selected={isSel} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto pt-6">
        <BottomCTA
          caption="Next take a picture of what happened"
          disabled={!selected}
          onClick={onContinue}
        >
          Continue to camera
        </BottomCTA>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 3 · Capture (decorative — native camera handles the actual capture)
// ════════════════════════════════════════════════════════════════════════════

function CaptureScreen({
  category,
  onTrigger,
}: {
  category: Category;
  onTrigger: () => void;
}) {
  return (
    <div className="relative flex flex-1 flex-col bg-black px-[18px] pb-6 pt-5">
      <div className="flex flex-1 items-center justify-center">
        <div className="relative aspect-[3/4] w-full max-w-[300px]">
          <Bracket pos="tl" />
          <Bracket pos="tr" />
          <Bracket pos="bl" />
          <Bracket pos="br" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] uppercase tracking-wider text-white/45">
              [ {category.id === "device" ? "damaged item" : "evidence"} in frame ]
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-center pb-2">
        <span className="rounded-xl bg-black/55 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur">
          Hold steady · Fill the frame · Good light
        </span>
      </div>

      <div className="flex items-center justify-center pt-3">
        <button
          type="button"
          onClick={onTrigger}
          aria-label="Take photo"
          className="flex h-[78px] w-[78px] items-center justify-center rounded-full border-[3px] border-white bg-white/10 active:scale-95 transition-transform"
        >
          <span className="h-[60px] w-[60px] rounded-full bg-[var(--finn-blue)]" />
        </button>
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
  return <div aria-hidden className={`absolute h-7 w-7 border-[var(--finn-blue)] ${map[pos]}`} />;
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 4 · Review photo
// ════════════════════════════════════════════════════════════════════════════

function ReviewScreen({
  category,
  previewUrl,
  classification,
  onRetake,
  onContinue,
}: {
  category: Category;
  previewUrl: string;
  classification: ClassifyResult | null;
  onRetake: () => void;
  onContinue: () => void;
}) {
  void category;
  // Pill label = whatever the AI actually saw. Falls back to a friendly
  // placeholder while the classify-photo round-trip is in flight, and to a
  // generic "evidence" label if it never returns (network blip etc.).
  const pillLabel = classification
    ? formatPhotoPill(classification)
    : "analyzing\u2026";
  const pillColor =
    classification?.kind === "damage"
      ? "var(--finn-danger)"
      : classification?.kind === "receipt"
        ? "var(--finn-blue)"
        : classification
          ? "var(--finn-orange)"
          : "rgba(255,255,255,0.18)";
  return (
    <div className="flex flex-1 flex-col px-[18px] pb-6 pt-5">
      <FinnAvatar variant="neutral" />

      <h1 className="mt-5 text-[34px] font-extrabold leading-[36px] tracking-tight text-[var(--finn-text)]">
        Good shot?
      </h1>

      <p className="mt-3 text-[13px] leading-[15px] text-[var(--finn-muted)]">
        I&apos;ll analyze the damage from this photo in a second. If it&apos;s blurry or partial,
        you can retake it again.
      </p>

      <div className="relative mt-4 h-[240px] overflow-hidden rounded-[12px] bg-[var(--finn-card)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="Captured evidence" className="block h-full w-full object-cover" />
        <span
          className="absolute right-3 top-3 max-w-[80%] truncate rounded-md px-2.5 py-1 text-[10px] font-extrabold tracking-[0.04em] text-[var(--finn-bg)] transition-colors"
          style={{ background: pillColor }}
        >
          {pillLabel}
        </span>
      </div>

      <div className="mt-4 flex gap-3">
        <ActionPill tone="orange" icon={<RetakeIcon />} onClick={onRetake}>
          Retake
        </ActionPill>
        <ActionPill tone="blue" icon={<PlusIcon />} onClick={onRetake}>
          Add another
        </ActionPill>
      </div>

      <InfoCard className="mt-3">
        Next up: a ~20-second voice note. Tell me{" "}
        <span className="font-bold text-[var(--finn-text)]">when</span>,{" "}
        <span className="font-bold text-[var(--finn-text)]">where</span>, and{" "}
        <span className="font-bold text-[var(--finn-text)]">how</span> it happened. Just speak
        natural, no formalities necessary. I will do all the paperwork for you ;)
      </InfoCard>

      <div className="mt-auto pt-6">
        <BottomCTA caption="Next: explain me in details what happened" onClick={onContinue}>
          Record voice note
        </BottomCTA>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 5 · Voice (idle / recording / transcribing)
// ════════════════════════════════════════════════════════════════════════════

const VOICE_TOPICS: { n: number; t: string; s: string }[] = [
  { n: 1, t: "When did it happen?", s: "Try the exact date and time. \u201cTuesday around 6pm\u201d" },
  { n: 2, t: "Where were you?", s: "As precise as possible. \u201cIn front of the coffee shop on Main Street\u201d" },
  { n: 3, t: "How did it happen?", s: "Tell me exactly what happened. \u201cI dropped it and the screen cracked\u201d" },
  { n: 4, t: "Anyone else involved?", s: "Were other people involved? Did someone cause it?" },
  { n: 5, t: "Is it still usable?", s: "Works properly, partly, or dead? And where is it now?" },
];

function VoiceScreen({
  state,
  onStart,
  onStop,
  elapsed,
  stream,
}: {
  state: "idle" | "recording" | "transcribing";
  onStart: () => void;
  onStop: () => void;
  elapsed: number;
  stream: MediaStream | null;
}) {
  return (
    <div className="flex flex-1 flex-col px-[18px] pb-6 pt-5">
      <FinnAvatar variant="happy" />

      <h1 className="mt-5 text-[34px] font-extrabold leading-[36px] tracking-tight text-balance text-[var(--finn-text)]">
        Describe to me what happened in your own words.
      </h1>

      <p className="mt-3 text-[13px] leading-[15px] text-[var(--finn-muted)]">
        Hold the play button to record. Don&apos;t worry, just talk naturally, like you&apos;re
        telling a friend. I&apos;ll tick off the bits I hear.
      </p>

      <RecorderCard state={state} elapsed={elapsed} stream={stream} onStart={onStart} onStop={onStop} />

      <div className="mt-3 rounded-[16px] bg-[var(--finn-card)] p-2">
        <p className="px-2 py-2 text-[13px] leading-tight text-[var(--finn-muted)]">
          In your voice message, cover these, in any order. It will help me a lot get you the most
          coverage.
        </p>
        <ul className="space-y-0">
          {VOICE_TOPICS.map((row, i) => (
            <li
              key={row.n}
              className={`flex gap-3 px-2 pb-3 pt-1 ${
                i < VOICE_TOPICS.length - 1 ? "border-b border-[var(--finn-separator)]" : ""
              }`}
            >
              <NumberedBadge n={row.n} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-extrabold text-white">{row.t}</p>
                <p className="text-[12px] leading-snug text-[var(--finn-muted)]">{row.s}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto pt-6">
        <BottomCTA
          caption={
            state === "transcribing"
              ? "One sec — pulling out the facts"
              : state === "recording"
                ? "Tap stop when you're done"
                : "Speak as long as you need. Finn will cut the fluff"
          }
          disabled={state !== "recording"}
          onClick={state === "recording" ? onStop : () => {}}
        >
          {state === "transcribing" ? "Transcribing\u2026" : "Done — send to Finn"}
        </BottomCTA>
      </div>
    </div>
  );
}

function RecorderCard({
  state,
  elapsed,
  stream,
  onStart,
  onStop,
}: {
  state: "idle" | "recording" | "transcribing";
  elapsed: number;
  stream: MediaStream | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const tone =
    state === "recording" ? "var(--finn-danger)" : state === "transcribing" ? "var(--finn-blue)" : "var(--finn-blue)";
  return (
    <div className="mt-4 flex h-[88px] items-center gap-3 rounded-[16px] bg-[var(--finn-card)] px-3">
      <button
        type="button"
        onClick={state === "recording" ? onStop : state === "idle" ? onStart : undefined}
        aria-label={state === "recording" ? "Stop recording" : "Start recording"}
        disabled={state === "transcribing"}
        className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#2a0d0d] active:scale-95 transition-transform disabled:opacity-50"
        style={{ backgroundColor: state === "transcribing" ? "#1f2a3a" : "#2a0d0d" }}
      >
        {state === "recording" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--finn-danger)]/25" />
        )}
        {state === "idle" || state === "recording" ? (
          <span
            className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full"
            style={{ background: tone }}
          >
            {state === "recording" ? (
              <span className="block h-4 w-4 rounded-[3px] bg-white" />
            ) : (
              <span className="block h-4 w-4 rounded-full bg-white" />
            )}
          </span>
        ) : (
          <Spinner color="var(--finn-blue)" />
        )}
      </button>

      <div className="flex flex-1 flex-col">
        <div className="h-9">
          <Waveform
            stream={stream}
            barClassName={
              state === "recording" ? "bg-[var(--finn-blue)]" : "bg-[rgba(152,152,159,0.25)]"
            }
            bars={28}
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.06em] text-[var(--finn-danger)]">
            {state === "recording" ? (
              <>
                <span className="h-[7px] w-[7px] rounded-full bg-[var(--finn-danger)]" />
                RECORDING
              </>
            ) : (
              <span className="text-[var(--finn-muted)] tracking-[0.04em]">
                {state === "transcribing" ? "TRANSCRIBING" : "TAP TO START"}
              </span>
            )}
          </span>
          <span className="text-[13px] font-extrabold tabular-nums text-white">
            {formatTime(elapsed)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 6 · Confirm transcript ("Here's what I heard")
// ════════════════════════════════════════════════════════════════════════════

function ConfirmScreen({
  transcript,
  onConfirm,
  onRerecord,
}: {
  transcript: string;
  onConfirm: () => void;
  onRerecord: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-[18px] pb-6 pt-5">
      <FinnAvatar variant="happy" />

      <h1 className="mt-5 text-[34px] font-extrabold leading-[36px] tracking-tight text-[var(--finn-text)]">
        Sound right?
      </h1>

      <p className="mt-3 text-[13px] leading-[15px] text-[var(--finn-muted)]">
        Here&apos;s what I heard. If anything&apos;s off, re-record. Otherwise tap confirm and
        I&apos;ll work the rest.
      </p>

      <div className="mt-4 rounded-[16px] bg-[var(--finn-card)] p-4">
        <p className="text-[15px] leading-snug text-[var(--finn-text)]">
          &ldquo;{transcript}&rdquo;
        </p>
      </div>

      <button
        type="button"
        onClick={onRerecord}
        className="mt-3 inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-[var(--finn-blue)] active:opacity-60 transition-opacity"
      >
        <span aria-hidden className="flex h-4 w-4 items-center justify-center">
          <RetakeIcon />
        </span>
        Re-record
      </button>

      <div className="mt-auto pt-6">
        <BottomCTA caption="I'll match this with your bunq history + policy" onClick={onConfirm}>
          Sounds right — analyze
        </BottomCTA>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stage 7 · Analyzing — six-step checklist
// ════════════════════════════════════════════════════════════════════════════

function AnalyzingScreen({ step }: { step: SubmitStep }) {
  const currentIdx = STEP_SEQUENCE.indexOf(step);
  return (
    <div className="flex flex-1 flex-col px-[18px] pb-6 pt-5">
      <div className="mx-auto mt-2 h-[210px] w-[210px] relative">
        <Image
          src="/finn/finn-thinking.png"
          alt="Finn thinking"
          fill
          sizes="210px"
          priority
          className="object-contain"
        />
      </div>

      <h1 className="mt-3 text-center text-[34px] font-extrabold leading-[36px] tracking-tight text-[var(--finn-text)]">
        On it! Give me a few seconds..
      </h1>

      <p className="mt-3 text-center text-[15px] leading-snug text-[var(--finn-body)]">
        I&apos;m crunching all the details together, analyzing the numbers, running six checks in
        parallel — reading your photo, listening to your note, matching your purchase, and
        comparing it all to your policy.
      </p>

      <ul className="mt-4 rounded-[16px] bg-[var(--finn-card)] p-2">
        {STEP_SEQUENCE.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const last = i === STEP_SEQUENCE.length - 1;
          return (
            <li
              key={s}
              className={`flex items-center gap-3 px-2 pb-3 pt-2.5 ${
                last ? "" : "border-b border-[var(--finn-separator)]"
              }`}
            >
              <CheckCircle done={done} active={active} />
              <p
                className={`text-[16px] font-bold ${
                  done || active ? "text-[var(--finn-text)]" : "text-[var(--finn-muted)]"
                }`}
              >
                {STEP_LABELS[s]}
                {active ? "\u2026" : ""}
              </p>
            </li>
          );
        })}
      </ul>
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
  const isApproved = tone === "approved";
  const payout = decision.payout_eur || decision.claim_amount_eur;

  return (
    <div className="flex flex-1 flex-col px-[18px] pb-6 pt-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onAgain}
          className="text-[13px] font-semibold text-[var(--finn-blue)] active:opacity-60"
        >
          Done
        </button>
        <button
          type="button"
          onClick={onAgain}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-[20px] bg-white/[0.06] active:opacity-60"
        >
          <span className="text-[14px] font-semibold text-white">{"\u2715"}</span>
        </button>
      </div>

      <ProgressBar value={TOTAL_STEPS} total={TOTAL_STEPS} />

      <div className="mx-auto mt-3 h-[172px] w-[178px] relative">
        <Image
          src={isApproved ? "/finn/finn-celebrate.png" : "/finn/finn-thinking.png"}
          alt="Finn"
          fill
          sizes="178px"
          priority
          className="object-contain"
        />
      </div>

      <h1 className="mt-3 text-center text-[34px] font-extrabold leading-[36px] tracking-tight text-[var(--finn-text)]">
        {isApproved
          ? "Payout Confirmed!"
          : tone === "escalated"
            ? "Let me loop in a human"
            : "Can't cover this one"}
      </h1>

      <p className="mt-3 text-center text-[15px] leading-snug text-[var(--finn-body)]">
        {decision.reason}
      </p>

      {isApproved && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-[16px] bg-[var(--finn-card)] px-3 py-4 text-center">
          <p className="text-[13px] font-semibold text-[var(--finn-text)]">Approved</p>
          <p className="text-[var(--finn-success)] tabular-nums">
            <span className="text-[42px] font-extrabold leading-[1.1]">{formatEUR(payout)}</span>
          </p>
          <p className="text-[13px] font-bold text-[var(--finn-muted)]">
            The funds will be deposited into your account soon.
          </p>
        </div>
      )}

      <div className="mt-3 rounded-[16px] bg-[var(--finn-card)] p-2">
        <MetaRow k="Claim ID" v={`SC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`} />
        <MetaRow
          k="Damage"
          v={`${decision.damage_type ?? "—"} · ${decision.severity ?? "—"}`}
        />
        <MetaRow k="Claim amount" v={formatEUR(decision.claim_amount_eur)} />
        {decision.deductible_eur ? (
          <MetaRow k="Deductible" v={`-${formatEUR(decision.deductible_eur)}`} />
        ) : null}
        <MetaRow k="Confidence" v={`${Math.round(decision.confidence * 100)}%`} />
        {decision.matched_payment_id ? (
          <MetaRow k="Matched payment" v={`#${decision.matched_payment_id}`} />
        ) : null}
        <MetaRow k="Policy" v={decision.policy_clause ?? "bunq Easy Insurance"} last />
      </div>

      <div className="mt-auto pt-6">
        <Link
          href="/"
          className="flex h-[52px] w-full items-center justify-center rounded-[10px] text-[18px] font-extrabold leading-[30px]"
          style={{
            backgroundColor: isApproved ? "var(--finn-success)" : "var(--finn-blue)",
            color: isApproved ? "var(--finn-bg)" : "var(--finn-text)",
          }}
        >
          Back to Homepage
        </Link>
      </div>
    </div>
  );
}

function MetaRow({ k, v, last = false }: { k: string; v: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-2 pb-3 pt-2.5 ${
        last ? "" : "border-b border-[var(--finn-separator)]"
      }`}
    >
      <span className="flex-1 text-[14px] font-medium text-[var(--finn-body)]">{k}</span>
      <span className="text-[13px] font-semibold text-white">{v}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Error
// ════════════════════════════════════════════════════════════════════════════

function ErrorScreen({ error, onReset }: { error: string; onReset: () => void }) {
  return (
    <div className="flex flex-1 flex-col px-[18px] pb-6 pt-5">
      <FinnAvatar variant="neutral" />
      <h1 className="mt-5 text-[34px] font-extrabold leading-[36px] tracking-tight text-[var(--finn-text)]">
        Something tripped me up.
      </h1>
      <p className="mt-3 text-[15px] leading-snug text-[var(--finn-body)]">{error}</p>
      <div className="mt-auto pt-6">
        <BottomCTA caption="Promise it'll work this time" onClick={onReset}>
          Try again
        </BottomCTA>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Shared bits — Finn avatar, badges, info card, CTAs, icons
// ════════════════════════════════════════════════════════════════════════════

function FinnAvatar({
  variant,
  size = 72,
}: {
  variant: "neutral" | "happy" | "thinking" | "celebrate";
  size?: number;
}) {
  const src =
    variant === "neutral"
      ? "/finn/finn-neutral.png"
      : variant === "happy"
        ? "/finn/finn-happy.png"
        : variant === "thinking"
          ? "/finn/finn-thinking.png"
          : "/finn/finn-celebrate.png";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Image src={src} alt="Finn" fill sizes={`${size}px`} priority className="object-contain" />
    </div>
  );
}

function NumberedBadge({ n }: { n: number }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[16px] border-2 border-[var(--finn-orange)] bg-[var(--finn-orange-fill)] text-[13px] font-extrabold text-white">
      {n}
    </span>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
        selected ? "bg-[var(--finn-blue)]" : "border-[1.5px] border-[#3a3a3c]"
      }`}
    >
      {selected && (
        <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
          <path d="M3 8.5L6.5 12 13 4.5" />
        </svg>
      )}
    </span>
  );
}

function CheckCircle({ done, active }: { done: boolean; active: boolean }) {
  if (done) {
    return (
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--finn-success)]">
        <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
          <path d="M3 8.5L6.5 12 13 4.5" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
        active ? "border-[var(--finn-blue)] animate-pulse" : "border-[#3a3a3c]"
      }`}
    />
  );
}

function InfoCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[16px] bg-[var(--finn-card)] p-2 ${className}`}>
      <div className="flex items-center gap-3 px-2 pt-1">
        <span className="relative flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full bg-[var(--finn-blue)] text-[10px] font-extrabold leading-none text-white">
          i
        </span>
        <p className="text-[14px] font-bold text-[var(--finn-text)]">Good to know</p>
      </div>
      <p className="mt-1 px-2 pb-2 text-[13px] leading-[15px] text-[var(--finn-muted)]">
        {children}
      </p>
    </div>
  );
}

function BottomCTA({
  children,
  onClick,
  caption,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  caption?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      {caption && (
        <p className="text-center text-[13px] font-semibold text-[var(--finn-muted)]">{caption}</p>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[var(--finn-blue)] text-[18px] font-extrabold leading-[30px] text-[var(--finn-text)] transition-opacity active:opacity-80 disabled:opacity-30"
      >
        {children}
      </button>
    </div>
  );
}

function ActionPill({
  children,
  tone,
  icon,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  tone: "orange" | "blue";
  icon?: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  const toneStyle =
    tone === "orange"
      ? { bg: "#662900", border: "var(--finn-orange)", dot: "var(--finn-orange)" }
      : { bg: "#003666", border: "var(--finn-blue)", dot: "var(--finn-blue)" };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-[16px] border-2 px-4 py-3 text-[13px] font-extrabold text-white active:opacity-80 transition-opacity ${className}`}
      style={{ backgroundColor: toneStyle.bg, borderColor: toneStyle.border }}
    >
      <span
        aria-hidden
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-white"
        style={{ background: toneStyle.dot }}
      >
        {icon}
      </span>
      {children}
    </button>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 2L3.5 7 9 12" />
    </svg>
  );
}

function RetakeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 7a5 5 0 1 1 1.5 3.5" />
      <path d="M2 4v3h3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Compose a tight label out of a ClassifyResult so the Review-screen pill
 *  reads "iPhone — cracked screen" instead of just "damage". Falls back
 *  gracefully when the model only returned one of the two fields. */
function formatPhotoPill(c: ClassifyResult): string {
  const subject = c.subject?.trim();
  const summary = c.summary?.trim();
  if (subject && summary) return `${subject} \u2014 ${summary}`.toLowerCase();
  return (subject || summary || c.kind || "evidence").toLowerCase();
}
