"use client";

import Image from "next/image";
import { ProcessingCard, DecisionCard, type SubmitStep } from "../claim/decision";
import type { ClaimResponse } from "@/lib/claim";
import Waveform from "./waveform";

export type ClaimPhase =
  | { kind: "voice" }
  | { kind: "voiceRecording"; elapsed: number }
  | { kind: "transcribing" }
  | { kind: "photo" }
  | { kind: "processing"; step: SubmitStep }
  | { kind: "decided"; result: ClaimResponse }
  | { kind: "error"; error: string };

export default function ClaimMessage({
  phase,
  recordingStream,
  onPickPhoto,
  onStartVoice,
  onStopVoice,
  onCancelVoice,
  onNewClaim,
  voiceMaxSeconds,
}: {
  phase: ClaimPhase;
  recordingStream: MediaStream | null;
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
        {phase.kind === "voice" && (
          <VoiceCard
            onStart={onStartVoice}
            state="idle"
            elapsed={0}
            max={voiceMaxSeconds}
            stream={null}
          />
        )}
        {phase.kind === "voiceRecording" && (
          <VoiceCard
            onStart={onStartVoice}
            onStop={onStopVoice}
            onCancel={onCancelVoice}
            state="recording"
            elapsed={phase.elapsed}
            max={voiceMaxSeconds}
            stream={recordingStream}
          />
        )}
        {phase.kind === "transcribing" && <TranscribingCard />}
        {phase.kind === "photo" && <PhotoCard onPick={onPickPhoto} />}
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

function PhotoCard({ onPick }: { onPick: () => void }) {
  return (
    <>
      <Bubble>
        Got it. Now <strong>send me a photo</strong> of the damage, the receipt, or the delay notice — so I can take a look.
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
        <span className="font-medium">Send a photo</span>
        <span className="text-muted text-xs ml-auto group-hover:text-foreground transition-colors">
          camera or upload
        </span>
      </button>
    </>
  );
}

function TranscribingCard() {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 flex items-center gap-3 text-sm">
      <span className="inline-flex items-center gap-1 text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint-8)] animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint-8)] animate-pulse [animation-delay:200ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint-8)] animate-pulse [animation-delay:400ms]" />
      </span>
      <span className="text-muted">Transcribing what you said…</span>
    </div>
  );
}

function VoiceCard({
  onStart,
  onStop,
  onCancel,
  state,
  elapsed,
  max,
  stream,
}: {
  onStart: () => void;
  onStop?: () => void;
  onCancel?: () => void;
  state: "idle" | "recording";
  elapsed: number;
  max: number;
  stream: MediaStream | null;
}) {
  const remaining = Math.max(0, max - elapsed);
  const recording = state === "recording";
  return (
    <>
      <Bubble>
        Hey — <strong>what&apos;s going on?</strong> Tell me what happened, when, and what it cost.
        Up to {max} seconds.
      </Bubble>
      <div
        className={`rounded-2xl border transition-colors p-5 flex flex-col gap-4 ${
          recording
            ? "border-[var(--accent-border)] bg-accent text-[var(--accent-contrast)]"
            : "border-[var(--border)] bg-[var(--card)]"
        }`}
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={recording ? onStop : onStart}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className={`relative h-14 w-14 rounded-full flex items-center justify-center transition-transform shrink-0 ${
              recording
                ? "bg-[var(--accent-contrast)] text-accent active:scale-95"
                : "bg-accent text-[var(--accent-contrast)] hover:bg-accent-hover"
            }`}
          >
            {recording && (
              <span
                className="absolute inset-0 rounded-full bg-[var(--accent-contrast)] animate-ping opacity-30"
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
              {recording ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <>
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0" />
                  <path d="M12 18v3" />
                </>
              )}
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            {recording ? (
              <>
                <p className="text-lg font-semibold tabular-nums">{elapsed.toFixed(1)}s</p>
                <p className="text-xs opacity-80 tabular-nums">
                  auto-stops in {remaining.toFixed(0)}s · tap square to stop
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Tap and start talking</p>
                <p className="text-xs text-muted">{max}s max · I&apos;m listening</p>
              </>
            )}
          </div>
          {recording && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs opacity-80 hover:opacity-100 transition-opacity px-2"
            >
              cancel
            </button>
          )}
        </div>
        {recording && (
          <Waveform
            stream={stream}
            barClassName="bg-[var(--accent-contrast)]/85"
          />
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
