"use client";

// SnapClaim — full-screen claim flow on /claim.
//
// Stage order (intro now lives on BunqHome's lime entry card; /claim opens
// straight on category):
//   category       → CategoryStage (Figma 53:24, 1:1)
//   capture        → CaptureStage  (Figma 53:26, 1:1)
//   review         → "Good shot?" preview + retake
//   voice          → idle / recording / transcribing
//   confirm        → "Here's what I heard" — transcript review
//   analyzing      → "Give me a few seconds" — cycling backend steps
//   result         → approved / escalated / rejected verdict
//   error          → recoverable error with reset
//
// Visual language matches BunqHome: bg #05070a, lime #a8db45 accent,
// SF Pro Rounded via the .snap class. Voice/photo capture wires through the
// existing lib helpers so backend integration is unchanged.

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Waveform from "../chat/waveform";
import { submitClaim, type ClaimResponse, type Coverage } from "@/lib/claim";
import { formatEUR } from "@/lib/format";
import { createRecorder, transcribeBlob, type RecorderHandle } from "@/lib/voice";
import {
  cycleSubmitSteps,
  STEP_LABELS,
  STEP_SEQUENCE,
  STEP_SUBLABELS,
  type SubmitStep,
} from "./decision";
import CategoryStage, {
  CATEGORIES,
  type Category,
  type CategoryId,
} from "./stages/category";
import CaptureStage from "./stages/capture";

const MAX_RECORD_S = 20;

// Map the Figma-driven category set to the coverage codes the backend
// understands. Anything device-shaped → phone; anything trip-shaped → travel;
// the rest fall back to default (the LLM still routes them).
const COVERAGE_MAP: Record<CategoryId, Coverage> = {
  damaged: "phone",
  stolen: "phone",
  medical: "default",
  travel: "travel",
  vehicle: "default",
  other: "default",
};

type Stage =
  | { kind: "category"; selectedId: CategoryId | null }
  | { kind: "capture"; category: Category }
  | { kind: "review"; category: Category; file: File; preview: string }
  | { kind: "voice"; category: Category; file: File; preview: string }
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
  const [stage, setStage] = useState<Stage>({
    kind: "category",
    selectedId: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickerRef = useRef<{ cancel: () => void } | null>(null);

  // Stage ref so cleanup effect can revoke the latest preview URL.
  const stageRef = useRef<Stage>(stage);
  stageRef.current = stage;

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

  // ───────── handlers ─────────

  function selectCategory(c: Category) {
    setStage({ kind: "category", selectedId: c.id });
  }

  function continueFromCategory() {
    if (stage.kind !== "category" || !stage.selectedId) return;
    const category = CATEGORIES.find((c) => c.id === stage.selectedId);
    if (!category) return;
    setStage({ kind: "capture", category });
    // Open native camera immediately on advance
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  function onPhotoChosen(file: File) {
    const s = stageRef.current;
    if (s.kind !== "capture" && s.kind !== "review") return;
    if (s.kind === "review") URL.revokeObjectURL(s.preview);
    const preview = URL.createObjectURL(file);
    setStage({ kind: "review", category: s.category, file, preview });
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
      coverage: COVERAGE_MAP[category.id],
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
    setStage({ kind: "category", selectedId: null });
  }

  // ───────── render ─────────

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={stage.kind}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.3, 1] }}
        >
          {stage.kind === "category" && (
            <CategoryStage
              selectedId={stage.selectedId}
              onSelect={selectCategory}
              onContinue={continueFromCategory}
              onBack={() => history.back()}
              onClose={() => (window.location.href = "/")}
            />
          )}

          {stage.kind === "capture" && (
            <CaptureStage
              onShutter={() => fileInputRef.current?.click()}
              onBack={() =>
                setStage({ kind: "category", selectedId: stage.category.id })
              }
              onClose={() => (window.location.href = "/")}
              categoryLabel={stage.category.label}
            />
          )}

          {stage.kind === "review" && (
            <ReviewScreen
              category={stage.category}
              previewUrl={stage.preview}
              file={stage.file}
              onRetake={retakePhoto}
              onContinue={continueToVoice}
              onBack={() =>
                setStage({ kind: "category", selectedId: stage.category.id })
              }
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
        </motion.div>
      </AnimatePresence>

      {/* Hidden file input — triggered by Capture / Retake */}
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
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stages still rendered inline below (review · voice · confirm · analyzing ·
// result · error). All share the bunq-home palette: bg #05070a, surface
// #12151a, lime #a8db45, secondary text #8c99a6, SF Pro Rounded via .snap.
// ════════════════════════════════════════════════════════════════════════════

function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)",
      }}
    >
      {children}
    </div>
  );
}

function NavBar({
  onBack,
  title,
  backLabel = "Back",
}: {
  onBack: () => void;
  title: string;
  backLabel?: string;
}) {
  return (
    <div className="relative h-14 px-3">
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="absolute left-3 top-2 flex h-10 w-10 items-center justify-center rounded-[20px] bg-white/[0.06] text-white active:opacity-70"
      >
        <ChevronLeft />
      </button>
      <p className="pt-[18px] text-center text-[17px] font-semibold leading-none text-white">
        {title}
      </p>
    </div>
  );
}

function PrimaryCTA({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center rounded-[28px] bg-[#a8db45] text-[16px] font-bold text-[#05070a] transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
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
      className="flex h-14 w-full items-center justify-center rounded-[28px] border border-white/[0.12] bg-[#12151a] text-[15px] font-semibold text-white active:opacity-80"
    >
      {children}
    </button>
  );
}

function FixedFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 space-y-2 px-5"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
    >
      {children}
    </div>
  );
}

// ─────────── Review screen ───────────

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
    <ScreenShell>
      <NavBar onBack={onBack} title="Review · photo" />

      <div className="px-5">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.7px] text-white">
          Good shot?
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#8c99a6]">
          I&apos;ll read the {category.label.toLowerCase()} from this photo. If
          it&apos;s blurry or cropped, retake — saves us both time.
        </p>
      </div>

      <div className="relative mt-5 px-5">
        <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Captured evidence"
            className="block w-full max-h-[58vh] object-cover"
          />
          <div className="absolute left-3 top-3">
            <span className="rounded-lg bg-black/65 px-2.5 py-1 text-[10px] text-white backdrop-blur">
              {file.name.length > 22
                ? file.name.slice(0, 20) + "…"
                : file.name}
              {" · "}
              {formatBytes(file.size)}
            </span>
          </div>
        </div>
      </div>

      <FinnInline className="mt-5">
        <span className="font-semibold">Next up:</span> a 20-second voice note —
        when, where, and how it happened.
      </FinnInline>

      <FixedFooter>
        <PrimaryCTA onClick={onContinue}>Looks good · voice note</PrimaryCTA>
        <SecondaryCTA onClick={onRetake}>Retake</SecondaryCTA>
      </FixedFooter>
    </ScreenShell>
  );
}

// ─────────── Voice screen ───────────

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
  void category;
  const remaining = Math.max(0, MAX_RECORD_S - elapsed);
  return (
    <ScreenShell>
      <NavBar
        onBack={state === "idle" ? onBack : onCancel}
        title={state === "transcribing" ? "Transcribing" : "Voice note"}
        backLabel={state === "recording" ? "Cancel" : "Back"}
      />

      <div className="px-5">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.7px] text-white">
          {state === "idle" && "Tell me what happened."}
          {state === "recording" && "Listening…"}
          {state === "transcribing" && "Reading you back…"}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#8c99a6]">
          {state === "idle" &&
            "When, where, and how it happened — and what it cost."}
          {state === "recording" &&
            "Up to 20 seconds. Tap stop when you're done."}
          {state === "transcribing" && "One second — pulling out the facts."}
        </p>
      </div>

      <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
        <div className="text-[64px] font-light leading-none tabular-nums tracking-tight">
          {formatTime(state === "idle" ? 0 : elapsed)}
        </div>
        <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#8c99a6]">
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
              state === "recording" ? "bg-[#a8db45]" : "bg-[#8c99a6]/60"
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
              className="flex h-20 w-20 items-center justify-center rounded-full bg-[#a8db45] active:scale-95 transition-transform"
            >
              <MicGlyph color="#05070a" />
            </button>
          )}
          {state === "recording" && (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop recording"
              className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[#a8db45] active:scale-95 transition-transform"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-[#a8db45]/30" />
              <span className="relative h-7 w-7 rounded-md bg-[#05070a]" />
            </button>
          )}
          {state === "transcribing" && (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#a8db45]/30">
              <Spinner color="#a8db45" />
            </div>
          )}
        </div>
      </div>
    </ScreenShell>
  );
}

// ─────────── Confirm transcript ───────────

function ConfirmScreen({
  transcript,
  onConfirm,
  onRerecord,
  onBack,
}: {
  transcript: string;
  onConfirm: () => void;
  onRerecord: () => void;
  onBack: () => void;
}) {
  return (
    <ScreenShell>
      <NavBar onBack={onBack} title="Here's what I heard" />

      <div className="px-5">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.7px] text-white">
          Sound right?
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[#8c99a6]">
          If anything&apos;s off, re-record. Otherwise tap confirm and
          I&apos;ll work the rest.
        </p>
      </div>

      <div className="mt-6 px-5">
        <div className="rounded-[20px] border border-white/[0.08] bg-[#12151a] p-4">
          <div className="flex items-start gap-2.5">
            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#a8db45] text-[12px] font-extrabold text-[#05070a]">
              F
            </div>
            <p className="text-[15px] leading-relaxed text-white">
              &ldquo;{transcript}&rdquo;
            </p>
          </div>
        </div>
      </div>

      <FixedFooter>
        <PrimaryCTA onClick={onConfirm}>Sounds right · analyze</PrimaryCTA>
        <SecondaryCTA onClick={onRerecord}>Re-record</SecondaryCTA>
      </FixedFooter>
    </ScreenShell>
  );
}

// ─────────── Analyzing ───────────

function AnalyzingScreen({ step }: { step: SubmitStep }) {
  const currentIdx = STEP_SEQUENCE.indexOf(step);
  return (
    <ScreenShell>
      <div className="flex flex-col items-center text-center pt-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#a8db45] text-2xl font-extrabold text-[#05070a]">
          F
        </div>
        <h1 className="mt-5 text-[28px] font-bold leading-tight tracking-[-0.7px] text-white">
          Give me a few seconds.
        </h1>
        <p className="mt-2 max-w-[28ch] text-[13px] leading-relaxed text-[#8c99a6]">
          Running a few checks in parallel — usually about{" "}
          <span className="text-white">8 seconds</span>.
        </p>
      </div>

      <ol className="mt-10 space-y-3 px-5">
        {STEP_SEQUENCE.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          const dim = !done && !active;
          return (
            <li
              key={s}
              className={`flex items-start gap-3 rounded-[14px] border px-3.5 py-3 ${
                active
                  ? "border-[#a8db45]/40 bg-[#a8db45]/[0.06]"
                  : "border-white/[0.08] bg-[#12151a]"
              } ${dim ? "opacity-50" : ""}`}
            >
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  done
                    ? "bg-[#a8db45]"
                    : active
                      ? "bg-[#a8db45] animate-pulse"
                      : "bg-[#8c99a6]"
                }`}
              />
              <div className="min-w-0">
                <p className="text-[15px] font-medium leading-tight text-white">
                  {STEP_LABELS[s]}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-[#8c99a6]">
                  {STEP_SUBLABELS[s]}
                </p>
              </div>
              {done && (
                <span className="ml-auto text-[#a8db45]">
                  <CheckIcon />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </ScreenShell>
  );
}

// ─────────── Result ───────────

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
    <ScreenShell>
      <NavBar onBack={onAgain} title="Done" backLabel="New" />

      <div className="px-5">
        <ResultPill tone={tone} />

        {tone === "approved" ? (
          <>
            <p className="mt-6 text-[10px] uppercase tracking-[0.14em] text-[#8c99a6]">
              Paid to your bunq account
            </p>
            <p className="mt-2 text-[56px] font-bold leading-none tabular-nums tracking-tight text-white">
              {formatEUR(decision.payout_eur || decision.claim_amount_eur)}
            </p>
          </>
        ) : tone === "escalated" ? (
          <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.7px] text-white">
            A specialist is picking this up.
          </h1>
        ) : (
          <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.7px] text-white">
            This isn&apos;t covered.
          </h1>
        )}

        <p className="mt-3 text-[13px] leading-relaxed text-[#8c99a6]">
          {decision.reason}
        </p>

        <div className="mt-6 space-y-3">
          <MetaRow
            k="Damage"
            v={`${decision.damage_type} · ${decision.severity}`}
          />
          <MetaRow
            k="Claim amount"
            v={formatEUR(decision.claim_amount_eur)}
          />
          {decision.deductible_eur ? (
            <MetaRow
              k="Deductible"
              v={`-${formatEUR(decision.deductible_eur)}`}
            />
          ) : null}
          <MetaRow
            k="Confidence"
            v={`${Math.round(decision.confidence * 100)}%`}
          />
          {decision.matched_payment_id ? (
            <MetaRow
              k="Matched payment"
              v={`#${decision.matched_payment_id}`}
            />
          ) : null}
          {decision.policy_clause && (
            <MetaRow k="Policy clause" v={decision.policy_clause} />
          )}
        </div>
      </div>

      <FixedFooter>
        <PrimaryCTA onClick={onAgain}>
          {tone === "approved" ? "Done" : "File another"}
        </PrimaryCTA>
        <Link
          href="/"
          className="flex h-14 w-full items-center justify-center rounded-[28px] border border-white/[0.12] bg-[#12151a] text-[15px] font-semibold text-white active:opacity-80"
        >
          Back to bunq
        </Link>
      </FixedFooter>
    </ScreenShell>
  );
}

function ResultPill({
  tone,
}: {
  tone: "approved" | "escalated" | "rejected";
}) {
  const map = {
    approved: {
      label: "Approved · paid",
      color: "#a8db45",
      bg: "rgba(168,219,69,0.08)",
      border: "rgba(168,219,69,0.32)",
    },
    escalated: {
      label: "Needs a human look",
      color: "#ffb340",
      bg: "rgba(255,179,64,0.08)",
      border: "rgba(255,179,64,0.3)",
    },
    rejected: {
      label: "Can't cover this one",
      color: "#ff6b6b",
      bg: "rgba(255,107,107,0.08)",
      border: "rgba(255,107,107,0.3)",
    },
  } as const;
  const t = map[tone];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.14em]"
      style={{ color: t.color, borderColor: t.border, background: t.bg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: t.color }}
      />
      {t.label}
    </span>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.08] pb-2.5">
      <span className="text-[13px] text-[#8c99a6]">{k}</span>
      <span className="text-right text-[14px] tabular-nums text-white">
        {v}
      </span>
    </div>
  );
}

// ─────────── Error ───────────

function ErrorScreen({
  error,
  onReset,
}: {
  error: string;
  onReset: () => void;
}) {
  return (
    <ScreenShell>
      <div className="px-5 pt-12">
        <ResultPill tone="rejected" />
        <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-[-0.7px] text-white">
          Something tripped me up.
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-[#8c99a6]">
          {error}
        </p>
      </div>
      <FixedFooter>
        <PrimaryCTA onClick={onReset}>Try again</PrimaryCTA>
      </FixedFooter>
    </ScreenShell>
  );
}

// ─────────── Inline Finn line (review screen) ───────────

function FinnInline({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-5 ${className}`}>
      <div className="flex items-start gap-2.5">
        <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#a8db45] text-[12px] font-extrabold text-[#05070a]">
          F
        </div>
        <div
          className="flex-1 bg-[#12151a] px-3 py-2.5 text-[13px] leading-relaxed text-white"
          style={{ borderRadius: "4px 14px 14px 14px" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────── icons + helpers ───────────

function ChevronLeft() {
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
      <path d="M9 2L3.5 7 9 12" />
    </svg>
  );
}

function MicGlyph({ color }: { color: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8.5L6.5 12 13 4.5" />
    </svg>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
