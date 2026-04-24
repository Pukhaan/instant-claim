"use client";

import Link from "next/link";
import { formatEUR } from "@/lib/format";
import type { ClaimResponse } from "@/lib/claim";

export type SubmitStep =
  | "reading_photo"
  | "transcribing"
  | "checking_transactions"
  | "applying_policy"
  | "deciding";

export const STEP_LABELS: Record<SubmitStep, string> = {
  reading_photo: "Looking at the photo…",
  transcribing: "Transcribing your voice note…",
  checking_transactions: "Checking your bunq transactions…",
  applying_policy: "Applying your policy…",
  deciding: "Making a decision…",
};

export const STEP_SEQUENCE: SubmitStep[] = [
  "reading_photo",
  "transcribing",
  "checking_transactions",
  "applying_policy",
  "deciding",
];

/** Cycles through the cosmetic "what Teller is doing right now" steps while
 *  the real backend request is in flight. */
export function cycleSubmitSteps(setStep: (s: SubmitStep) => void) {
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

/** Staged "we're processing your claim" indicator. Used both in the page
 *  wizard and inline in chat. Keep card-only — no headings. */
export function ProcessingCard({ step }: { step: SubmitStep }) {
  const currentIdx = STEP_SEQUENCE.indexOf(step);
  return (
    <ol className="space-y-3">
      {STEP_SEQUENCE.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={s} className="flex items-center gap-3">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
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
  );
}

/** The full result rendering: hero verdict, meta, transcript, policy clause.
 *  Used both standalone (page wizard) and inline (chat flow). */
export function DecisionCard({
  result,
  onNewClaim,
  showSandboxLink = true,
}: {
  result: ClaimResponse;
  onNewClaim?: () => void;
  showSandboxLink?: boolean;
}) {
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
    tone === "approve"
      ? "bg-accent"
      : tone === "escalate"
        ? "bg-[var(--tint-9)]"
        : "bg-[var(--danger)]";

  return (
    <section className="space-y-4">
      <div className={`rounded-3xl border ${toneClass} p-5 md:p-6`}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] mb-3">
          <span className={`h-1.5 w-1.5 rounded-full ${toneDot}`} aria-hidden />
          <span className={tone === "reject" ? "text-[var(--danger)]" : "text-accent"}>
            {toneLabel}
          </span>
        </div>
        <p className="text-base md:text-lg leading-snug font-medium text-balance">
          {decision.reason}
        </p>
        {decision.decision === "approve" && decision.payout_eur > 0 && (
          <div className="mt-5 flex items-end gap-3">
            <p className="text-3xl md:text-4xl font-semibold tabular-nums tracking-tight">
              {formatEUR(decision.payout_eur)}
            </p>
            <p className="text-sm text-muted mb-1.5 tabular-nums">landed in your bunq account</p>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
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
            {transcript.confidence != null
              ? `${Math.round(transcript.confidence * 100)}% conf`
              : "—"}
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

      {(onNewClaim || showSandboxLink) && (
        <div className="flex items-center gap-3 pt-1">
          {onNewClaim && (
            <button
              onClick={onNewClaim}
              className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-[var(--accent-contrast)] hover:bg-accent-hover transition-colors"
            >
              File another claim
            </button>
          )}
          {showSandboxLink && (
            <Link
              href="/sandbox"
              className="inline-flex h-9 items-center rounded-full border border-[var(--border)] px-4 text-sm font-medium hover:border-[var(--border-strong)] hover:bg-[var(--input)] transition-colors"
            >
              See it in the sandbox →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

function MetaCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
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
