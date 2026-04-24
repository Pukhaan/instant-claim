"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatEUR } from "@/lib/format";
import { submitClaim, type ClaimResponse, type Coverage } from "@/lib/claim";
import { createRecorder, type RecorderHandle } from "@/lib/voice";

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

type SubmitStep =
  | "reading_photo"
  | "transcribing"
  | "checking_transactions"
  | "applying_policy"
  | "deciding";

const STEP_LABELS: Record<SubmitStep, string> = {
  reading_photo: "Looking at the photo…",
  transcribing: "Transcribing your voice note…",
  checking_transactions: "Checking your bunq transactions…",
  applying_policy: "Applying your policy…",
  deciding: "Making a decision…",
};

const STEP_SEQUENCE: SubmitStep[] = [
  "reading_photo",
  "transcribing",
  "checking_transactions",
  "applying_policy",
  "deciding",
];

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
  const currentIdx = STEP_SEQUENCE.indexOf(step);
  return (
    <section className="py-6 md:py-10">
      <h2 className="text-balance text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
        Teller is processing your claim.
      </h2>
      <p className="text-pretty mt-3 text-muted leading-relaxed max-w-xl">
        One multimodal Claude call is handling vision, transcription, matching, and policy — all at
        once.
      </p>
      <ol className="mt-10 space-y-4">
        {STEP_SEQUENCE.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li key={s} className="flex items-center gap-3">
              <span
                className={`h-2 w-2 rounded-full ${
                  done
                    ? "bg-accent"
                    : active
                      ? "bg-accent animate-pulse"
                      : "bg-[var(--tint-8)]"
                }`}
                aria-hidden
              />
              <span
                className={
                  done
                    ? "text-sm text-muted"
                    : active
                      ? "text-sm text-foreground font-medium"
                      : "text-sm text-muted"
                }
              >
                {STEP_LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DecisionCard({ result, onNewClaim }: { result: ClaimResponse; onNewClaim: () => void }) {
  const { decision, transcript, payout, policy } = result;
  const tone =
    decision.decision === "approve"
      ? "approve"
      : decision.decision === "escalate"
        ? "escalate"
        : "reject";
  const toneClass =
    tone === "approve"
      ? "border-[var(--accent-border)] bg-[var(--accent-subtle)]"
      : tone === "escalate"
        ? "border-[var(--border)] bg-[var(--card)]"
        : "border-[var(--danger)]/40 bg-[var(--danger)]/5";
  const toneLabel =
    tone === "approve" ? "Approved" : tone === "escalate" ? "Escalated to a human" : "Declined";
  const toneDot =
    tone === "approve" ? "bg-accent" : tone === "escalate" ? "bg-[var(--tint-9)]" : "bg-[var(--danger)]";

  return (
    <section className="space-y-4">
      <div className={`rounded-3xl border ${toneClass} p-6 md:p-8`}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] mb-3">
          <span className={`h-1.5 w-1.5 rounded-full ${toneDot}`} aria-hidden />
          <span className={tone === "reject" ? "text-[var(--danger)]" : "text-accent"}>{toneLabel}</span>
        </div>
        <p className="text-lg md:text-xl leading-snug font-medium text-balance">
          {decision.reason}
        </p>
        {decision.decision === "approve" && decision.payout_eur > 0 && (
          <div className="mt-6 flex items-end gap-3">
            <p className="text-4xl md:text-5xl font-semibold tabular-nums tracking-tight">
              {formatEUR(decision.payout_eur)}
            </p>
            <p className="text-sm text-muted mb-2 tabular-nums">
              landed in your bunq account
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetaCard label="What Teller saw">
          <ul className="space-y-1.5 text-sm">
            <Row k="Damage" v={decision.damage_type} />
            <Row k="Severity" v={decision.severity} />
            <Row k="Claim amount" v={formatEUR(decision.claim_amount_eur)} />
            {decision.deductible_eur ? (
              <Row k="Deductible" v={formatEUR(-decision.deductible_eur)} />
            ) : null}
            <Row k="Confidence" v={`${Math.round(decision.confidence * 100)}%`} />
            {decision.matched_payment_id ? (
              <Row k="Matched payment" v={`#${decision.matched_payment_id}`} />
            ) : null}
          </ul>
        </MetaCard>

        <MetaCard label="Voice transcript">
          <p className="text-sm text-muted italic leading-relaxed line-clamp-6">
            &ldquo;{transcript.text || "(no voice captured)"}&rdquo;
          </p>
          <p className="text-[11px] text-muted mt-3 tabular-nums">
            {transcript.language ?? "—"} ·{" "}
            {transcript.duration_s ? `${transcript.duration_s.toFixed(1)}s` : "—"} ·{" "}
            {transcript.confidence != null ? `${Math.round(transcript.confidence * 100)}% conf` : "—"}
          </p>
        </MetaCard>
      </div>

      <MetaCard label="Policy clause applied">
        <p className="text-sm text-foreground leading-relaxed">
          {decision.policy_clause || policy.clause}
        </p>
      </MetaCard>

      {payout?.error && (
        <MetaCard label="Payout note">
          <p className="text-sm text-muted">{payout.error}</p>
        </MetaCard>
      )}

      <div className="flex items-center gap-3 pt-2">
        <PrimaryButton onClick={onNewClaim}>File another claim</PrimaryButton>
        <Link
          href="/sandbox"
          className="inline-flex h-9 items-center rounded-full border border-[var(--border)] px-4 text-sm font-medium hover:border-[var(--border-strong)] hover:bg-[var(--input)] transition-colors"
        >
          See it in the sandbox →
        </Link>
      </div>
    </section>
  );
}

function MetaCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent mb-2">
        {label}
      </p>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="text-foreground tabular-nums">{v}</span>
    </li>
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

// -------------------- helpers --------------------

/**
 * Cycles through the fake "what Teller is doing right now" steps while
 * the real backend request is in flight. Purely cosmetic — when the real
 * response lands, we jump straight to the decision stage and the ticker
 * gets cancelled.
 */
function cycleSubmitSteps(setStep: (s: SubmitStep) => void): { cancel: () => void } {
  let i = 0;
  const interval = window.setInterval(() => {
    i = Math.min(i + 1, STEP_SEQUENCE.length - 1);
    setStep(STEP_SEQUENCE[i]);
  }, 1400);
  return {
    cancel() {
      window.clearInterval(interval);
    },
  };
}
