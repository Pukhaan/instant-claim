"use client";

import { useEffect, useRef, useState } from "react";
import { submitClaim, type ClaimResponse, type Coverage } from "@/lib/claim";
import { createRecorder, type RecorderHandle } from "@/lib/voice";
import {
  cycleSubmitSteps,
  DecisionCard,
  ProcessingCard,
  STEP_SEQUENCE,
  type SubmitStep,
} from "./decision";

const MAX_RECORD_SECONDS = 20;

type Stage =
  | { kind: "intro" }
  | { kind: "photo" }
  | { kind: "photoPreview"; file: File; preview: string }
  | { kind: "voice" }
  | { kind: "voiceRecording"; elapsed: number }
  | { kind: "voicePreview"; blob: Blob; duration: number }
  | { kind: "submitting"; step: SubmitStep }
  | { kind: "done"; result: ClaimResponse }
  | { kind: "error"; error: string };

export default function ClaimWizard() {
  const [stage, setStage] = useState<Stage>({ kind: "intro" });
  const [coverage, setCoverage] = useState<Coverage>("phone");
  const [photoFile, setPhotoFile] = useState<{ file: File; preview: string } | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<{ blob: Blob; duration: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (photoFile?.preview) URL.revokeObjectURL(photoFile.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    if (photoFile?.preview) URL.revokeObjectURL(photoFile.preview);
    setPhotoFile(null);
    setVoiceBlob(null);
    setStage({ kind: "intro" });
  }

  function onPhotoPicked(f: File) {
    const preview = URL.createObjectURL(f);
    if (photoFile?.preview) URL.revokeObjectURL(photoFile.preview);
    setPhotoFile({ file: f, preview });
    setStage({ kind: "photoPreview", file: f, preview });
  }

  async function startRecording() {
    try {
      recorderRef.current = createRecorder();
      await recorderRef.current.start();
      recordStartRef.current = Date.now();
      setStage({ kind: "voiceRecording", elapsed: 0 });
      recordTimerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - recordStartRef.current) / 1000;
        if (elapsed >= MAX_RECORD_SECONDS) {
          stopRecording();
        } else {
          setStage({ kind: "voiceRecording", elapsed });
        }
      }, 100) as unknown as number;
    } catch (err) {
      setStage({
        kind: "error",
        error: err instanceof Error ? err.message : "Mic permission denied",
      });
    }
  }

  async function stopRecording() {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    try {
      const blob = await recorderRef.current!.stop();
      const duration = (Date.now() - recordStartRef.current) / 1000;
      setVoiceBlob({ blob, duration });
      setStage({ kind: "voicePreview", blob, duration });
    } catch (err) {
      setStage({
        kind: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function cancelRecording() {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    recorderRef.current?.cancel();
    setStage({ kind: "voice" });
  }

  async function submit() {
    if (!photoFile || !voiceBlob) return;
    setStage({ kind: "submitting", step: "reading_photo" });
    const ticker = cycleSubmitSteps((step) =>
      setStage((s) => (s.kind === "submitting" ? { kind: "submitting", step } : s)),
    );
    try {
      const result = await submitClaim({
        image: photoFile.file,
        audio: voiceBlob.blob,
        coverage,
      });
      ticker.cancel();
      setStage({ kind: "done", result });
    } catch (err) {
      ticker.cancel();
      setStage({
        kind: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ------------- render -------------

  return (
    <div className="flex-1">
      {stage.kind === "intro" && (
        <Intro
          coverage={coverage}
          onCoverage={setCoverage}
          onStart={() => setStage({ kind: "photo" })}
        />
      )}

      {stage.kind === "photo" && (
        <StepShell title="Step 1 of 3 · Photo" subtitle="Snap the damaged item, the delay notice, or the bill. Claude will read it.">
          <DropZone onFile={onPhotoPicked} onPick={() => fileInputRef.current?.click()} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPhotoPicked(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="sr-only"
          />
        </StepShell>
      )}

      {stage.kind === "photoPreview" && (
        <StepShell title="Step 1 of 3 · Photo" subtitle="Looks good? Next we'll record what happened.">
          <figure className="rounded-3xl border border-[var(--border)] overflow-hidden bg-[var(--card)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={stage.preview} alt="Claim" className="block w-full max-h-[420px] object-contain bg-black/5" />
          </figure>
          <div className="mt-5 flex items-center gap-3">
            <PrimaryButton onClick={() => setStage({ kind: "voice" })}>Looks good → voice note</PrimaryButton>
            <SecondaryButton
              onClick={() => {
                if (photoFile?.preview) URL.revokeObjectURL(photoFile.preview);
                setPhotoFile(null);
                setStage({ kind: "photo" });
              }}
            >
              Retake
            </SecondaryButton>
          </div>
        </StepShell>
      )}

      {stage.kind === "voice" && (
        <StepShell title="Step 2 of 3 · Voice note" subtitle="In about 20 seconds, tell us what happened, when, and what it cost.">
          <VoiceCapture
            state="idle"
            onStart={startRecording}
            onStop={() => {}}
            elapsed={0}
          />
        </StepShell>
      )}

      {stage.kind === "voiceRecording" && (
        <StepShell title="Step 2 of 3 · Voice note" subtitle="Describe what happened, when, and what it cost.">
          <VoiceCapture
            state="recording"
            onStart={() => {}}
            onStop={stopRecording}
            elapsed={stage.elapsed}
            onCancel={cancelRecording}
          />
        </StepShell>
      )}

      {stage.kind === "voicePreview" && (
        <StepShell title="Step 2 of 3 · Voice note" subtitle="Short and clear works best. Re-record if you want.">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 flex items-center gap-4">
            <PlayablePreview blob={stage.blob} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Voice note ready</p>
              <p className="text-xs text-muted tabular-nums mt-0.5">
                {stage.duration.toFixed(1)}s
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <PrimaryButton onClick={submit}>Submit claim</PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setVoiceBlob(null);
                setStage({ kind: "voice" });
              }}
            >
              Re-record
            </SecondaryButton>
          </div>
        </StepShell>
      )}

      {stage.kind === "submitting" && <Submitting step={stage.step} />}

      {stage.kind === "done" && <DecisionCard result={stage.result} onNewClaim={reset} />}
      {/* DecisionCard imported from ./decision */}

      {stage.kind === "error" && (
        <div className="rounded-3xl border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-6">
          <p className="text-sm font-medium text-[var(--danger)]">Something went wrong</p>
          <pre className="mt-2 text-xs text-muted font-mono whitespace-pre-wrap">{stage.error}</pre>
          <div className="mt-4">
            <PrimaryButton onClick={reset}>Start over</PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------- sub-components --------------------

function Intro({
  coverage,
  onCoverage,
  onStart,
}: {
  coverage: Coverage;
  onCoverage: (c: Coverage) => void;
  onStart: () => void;
}) {
  return (
    <section className="py-4 md:py-10">
      <h1 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
        Got a claim? Take a photo, tell me what happened.
      </h1>
      <p className="text-pretty mt-3 text-muted max-w-2xl leading-relaxed">
        Teller reviews the damage, transcribes your voice note, cross-checks your bunq transactions
        against your policy, and decides — usually in under a minute. Approved claims land in your
        bunq account on the spot.
      </p>

      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent mb-3">
          What kind of claim?
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "phone", label: "Phone or device" },
              { id: "travel", label: "Travel (delay, luggage, medical)" },
              { id: "default", label: "Something else" },
            ] as const
          ).map((c) => {
            const active = coverage === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onCoverage(c.id)}
                className={
                  active
                    ? "inline-flex h-9 items-center rounded-full border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-4 text-sm font-medium text-foreground"
                    : "inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium text-muted hover:text-foreground hover:border-[var(--accent-border)] transition-colors"
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <PrimaryButton onClick={onStart}>Start claim →</PrimaryButton>
      </div>

      <p className="text-xs text-muted mt-10 max-w-xl leading-relaxed">
        Behind the scenes: one multimodal call to Claude does vision on the photo, applies your
        policy, and cross-references your bunq transactions. Auto-approved claims execute the
        payout immediately via the bunq API.
      </p>
    </section>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent mb-2">{title}</p>
      <h2 className="text-balance text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
        {subtitle}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function DropZone({
  onFile,
  onPick,
}: {
  onFile: (f: File) => void;
  onPick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`rounded-3xl border-2 border-dashed p-12 text-center transition-colors ${
        hover
          ? "border-accent bg-[var(--accent-subtle)]"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent-border)]"
      }`}
    >
      <div className="mx-auto max-w-xs space-y-3">
        <div
          className="mx-auto h-10 w-10 rounded-full bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-accent"
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </div>
        <p className="text-sm leading-relaxed">
          <button type="button" onClick={onPick} className="font-medium underline underline-offset-2">
            Take a photo
          </button>{" "}
          or drop one in.
        </p>
        <p className="text-xs text-muted">JPEG, PNG, WebP, HEIC · up to 6 MB</p>
      </div>
    </div>
  );
}

function VoiceCapture({
  state,
  onStart,
  onStop,
  onCancel,
  elapsed,
}: {
  state: "idle" | "recording";
  onStart: () => void;
  onStop: () => void;
  onCancel?: () => void;
  elapsed: number;
}) {
  const remaining = Math.max(0, MAX_RECORD_SECONDS - elapsed);
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 flex flex-col items-center text-center gap-6">
      <button
        type="button"
        onClick={state === "recording" ? onStop : onStart}
        aria-label={state === "recording" ? "Stop recording" : "Start recording"}
        className={`relative h-24 w-24 rounded-full flex items-center justify-center transition-transform ${
          state === "recording"
            ? "bg-accent text-[var(--accent-contrast)] scale-100 active:scale-95"
            : "bg-accent text-[var(--accent-contrast)] hover:bg-accent-hover"
        }`}
      >
        {state === "recording" && (
          <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-40" aria-hidden />
        )}
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative"
          aria-hidden
        >
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </svg>
      </button>

      {state === "recording" ? (
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {elapsed.toFixed(1)}s
          </p>
          <p className="text-xs text-muted tabular-nums mt-1">
            auto-stops in {remaining.toFixed(0)}s
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted leading-relaxed max-w-xs">
          Tap the mic and tell us what happened. Describe <em>what</em>, <em>when</em>, and{" "}
          <em>how much</em>.
        </p>
      )}

      {state === "recording" && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          cancel
        </button>
      )}
    </div>
  );
}

function PlayablePreview({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url ? (
    <audio src={url} controls className="h-10" />
  ) : (
    <span className="text-muted text-sm">loading…</span>
  );
}

function Submitting({ step }: { step: SubmitStep }) {
  return (
    <section className="py-6 md:py-10">
      <h2 className="text-balance text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
        Teller is processing your claim.
      </h2>
      <p className="text-pretty mt-3 text-muted leading-relaxed max-w-xl">
        One multimodal Claude call is handling vision, transcription, matching, and policy — all at
        once.
      </p>
      <div className="mt-10">
        <ProcessingCard step={step} />
      </div>
    </section>
  );
}

function PrimaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-[var(--accent-contrast)] hover:bg-accent-hover transition-colors"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-10 items-center rounded-full border border-[var(--border)] px-5 text-sm font-medium hover:border-[var(--border-strong)] hover:bg-[var(--input)] transition-colors"
    >
      {children}
    </button>
  );
}

// cycleSubmitSteps + STEP_SEQUENCE are imported from ./decision.
