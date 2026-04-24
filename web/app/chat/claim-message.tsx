"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ProcessingCard, DecisionCard, type SubmitStep } from "../claim/decision";
import type { ClaimResponse, Coverage } from "@/lib/claim";

export type ClaimPhase =
  | { kind: "coverage" }
  | { kind: "photo"; coverage: Coverage }
  | { kind: "voice"; coverage: Coverage }
  | { kind: "voiceRecording"; coverage: Coverage; elapsed: number }
  | { kind: "processing"; coverage: Coverage; step: SubmitStep }
  | { kind: "decided"; result: ClaimResponse }
  | { kind: "error"; error: string };

const COVERAGE_OPTIONS: { id: Coverage; label: string; lead: string }[] = [
  { id: "phone", label: "Phone or device", lead: "phone insurance" },
  { id: "travel", label: "Travel", lead: "travel insurance" },
  { id: "default", label: "Something else", lead: "your bunq policy" },
];

const COVERAGE_LEAD: Record<Coverage, string> = {
  phone: "phone insurance",
  travel: "travel insurance",
  default: "your bunq policy",
};

export default function ClaimMessage({
  phase,
  onCoverage,
  onPickPhoto,
  onStartVoice,
  onStopVoice,
  onCancelVoice,
  onNewClaim,
  voiceMaxSeconds,
}: {
  phase: ClaimPhase;
  onCoverage: (c: Coverage) => void;
  onPickPhoto: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onCancelVoice: () => void;
  onNewClaim?: () => void;
  voiceMaxSeconds: number;
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="flex-1 min-w-0 space-y-3 pt-0.5">
        {phase.kind === "coverage" && <CoverageCard onPick={onCoverage} />}
        {phase.kind === "photo" && (
          <PhotoCard coverage={phase.coverage} onPick={onPickPhoto} />
        )}
        {phase.kind === "voice" && (
          <VoiceCard coverage={phase.coverage} onStart={onStartVoice} state="idle" elapsed={0} max={voiceMaxSeconds} />
        )}
        {phase.kind === "voiceRecording" && (
          <VoiceCard
            coverage={phase.coverage}
            onStart={onStartVoice}
            onStop={onStopVoice}
            onCancel={onCancelVoice}
            state="recording"
            elapsed={phase.elapsed}
            max={voiceMaxSeconds}
          />
        )}
        {phase.kind === "processing" && <ProcessingChat step={phase.step} />}
        {phase.kind === "decided" && (
          <DecisionInline result={phase.result} onNewClaim={onNewClaim} />
        )}
        {phase.kind === "error" && <ErrorCard error={phase.error} />}
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span className="relative h-8 w-8 shrink-0 rounded-full overflow-hidden bg-[var(--card)] ring-1 ring-[var(--border)]">
      <Image src="/AI_Logo.png" alt="Teller" fill sizes="32px" />
    </span>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm leading-relaxed">
      {children}
    </div>
  );
}

function CoverageCard({ onPick }: { onPick: (c: Coverage) => void }) {
  return (
    <>
      <Bubble>
        Sure — what kind of claim is it?
      </Bubble>
      <div className="flex flex-wrap gap-2">
        {COVERAGE_OPTIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            className="inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium text-foreground hover:border-[var(--accent-border)] hover:bg-[var(--accent-subtle)] transition-colors"
          >
            {c.label}
          </button>
        ))}
      </div>
    </>
  );
}

function PhotoCard({ coverage, onPick }: { coverage: Coverage; onPick: () => void }) {
  return (
    <>
      <Bubble>
        Got it — {COVERAGE_LEAD[coverage]}. <strong>Take a photo</strong> of the damage, the receipt, or the delay notice.
      </Bubble>
      <button
        onClick={onPick}
        className="group inline-flex items-center gap-3 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] hover:bg-[var(--accent-subtle)] px-4 py-3 text-sm transition-colors"
      >
        <span
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-accent text-[var(--accent-contrast)] shrink-0"
          aria-hidden
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </span>
        <span className="font-medium">Take a photo</span>
        <span className="text-muted text-xs ml-auto group-hover:text-foreground transition-colors">
          camera or upload
        </span>
      </button>
    </>
  );
}

function VoiceCard({
  coverage,
  onStart,
  onStop,
  onCancel,
  state,
  elapsed,
  max,
}: {
  coverage: Coverage;
  onStart: () => void;
  onStop?: () => void;
  onCancel?: () => void;
  state: "idle" | "recording";
  elapsed: number;
  max: number;
}) {
  const remaining = Math.max(0, max - elapsed);
  return (
    <>
      <Bubble>
        Now <strong>tell me what happened</strong> — when, where, and what it cost. Up to {max} seconds.
      </Bubble>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 flex items-center gap-4">
        <button
          type="button"
          onClick={state === "recording" ? onStop : onStart}
          aria-label={state === "recording" ? "Stop recording" : "Start recording"}
          className={`relative h-14 w-14 rounded-full flex items-center justify-center text-[var(--accent-contrast)] transition-transform shrink-0 ${
            state === "recording"
              ? "bg-accent active:scale-95"
              : "bg-accent hover:bg-accent-hover"
          }`}
        >
          {state === "recording" && (
            <span
              className="absolute inset-0 rounded-full bg-accent animate-ping opacity-40"
              aria-hidden
            />
          )}
          <svg
            width="22"
            height="22"
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
        <div className="flex-1 min-w-0">
          {state === "recording" ? (
            <>
              <p className="text-lg font-semibold tabular-nums">{elapsed.toFixed(1)}s</p>
              <p className="text-xs text-muted tabular-nums">auto-stops in {remaining.toFixed(0)}s</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Tap to record</p>
              <p className="text-xs text-muted">{COVERAGE_LEAD[coverage]} · {max}s max</p>
            </>
          )}
        </div>
        {state === "recording" && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-muted hover:text-foreground transition-colors px-2"
          >
            cancel
          </button>
        )}
      </div>
    </>
  );
}

function ProcessingChat({ step }: { step: SubmitStep }) {
  return (
    <>
      <Bubble>
        On it — one multimodal Claude call is doing vision, transcription, transaction matching, and policy at once.
      </Bubble>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <ProcessingCard step={step} />
      </div>
    </>
  );
}

function DecisionInline({
  result,
  onNewClaim,
}: {
  result: ClaimResponse;
  onNewClaim?: () => void;
}) {
  return <DecisionCard result={result} onNewClaim={onNewClaim} showSandboxLink />;
}

function ErrorCard({ error }: { error: string }) {
  return (
    <section className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--danger)] mb-1.5">
        Something went wrong
      </p>
      <pre className="text-xs text-muted font-mono whitespace-pre-wrap">{error}</pre>
    </section>
  );
}
