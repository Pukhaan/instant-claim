"use client";

import { formatEUR } from "@/lib/format";
import type { ClaimResponse } from "@/lib/claim";

export type SubmitStep =
  | "reading_photo"
  | "extracting_facts"
  | "matching_purchase"
  | "checking_policy"
  | "sanity_checking"
  | "deciding";

export const STEP_LABELS: Record<SubmitStep, string> = {
  reading_photo: "Reading the photo",
  extracting_facts: "Pulling out the facts",
  matching_purchase: "Matching your purchase in bunq",
  checking_policy: "Checking your cover, clause by clause",
  sanity_checking: "Sanity-checking the numbers",
  deciding: "Making a call",
};

export const STEP_SUBLABELS: Record<SubmitStep, string> = {
  reading_photo: "Damage type, severity, evidence quality",
  extracting_facts: "What, when, where, how much",
  matching_purchase: "Date and merchant in your transaction history",
  checking_policy: "Your bunq Easy Travel + Device cover",
  sanity_checking: "Claim vs. typical repair / market value",
  deciding: "Approve, escalate, or decline — with reason",
};

export const STEP_SEQUENCE: SubmitStep[] = [
  "reading_photo",
  "extracting_facts",
  "matching_purchase",
  "checking_policy",
  "sanity_checking",
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
 *  wizard and inline in chat. Each step has a label + subtitle to mirror the
 *  SnapClaim "Finn is working" screen. */
export function ProcessingCard({ step }: { step: SubmitStep }) {
  const currentIdx = STEP_SEQUENCE.indexOf(step);
  return (
    <ol className="space-y-2.5">
      {STEP_SEQUENCE.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const dim = !done && !active;
        return (
          <li key={s} className="flex items-start gap-3">
            <span
              className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                done
                  ? "bg-accent"
                  : active
                    ? "bg-accent animate-pulse"
                    : "bg-[var(--tint-8)]"
              }`}
              aria-hidden
            />
            <div className={`min-w-0 ${dim ? "opacity-50" : ""}`}>
              <p
                className={
                  active
                    ? "text-sm font-medium text-foreground"
                    : done
                      ? "text-sm text-foreground"
                      : "text-sm text-foreground"
                }
              >
                {STEP_LABELS[s]}
              </p>
              <p className="text-[11px] text-muted leading-relaxed">{STEP_SUBLABELS[s]}</p>
            </div>
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
}: {
  result: ClaimResponse;
  onNewClaim?: () => void;
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

  const approved = decision.decision === "approve" && decision.payout_eur > 0;
  const escalated = decision.decision === "escalate";
  const rejected = decision.decision === "reject";
  const explainer = whatIDid(decision);

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
        {approved && (
          <div className="mt-5 flex items-end gap-3">
            <p className="text-3xl md:text-4xl font-semibold tabular-nums tracking-tight">
              {formatEUR(decision.payout_eur)}
            </p>
            <p className="text-sm text-muted mb-1.5 tabular-nums">landed in your bunq account</p>
          </div>
        )}
      </div>

      {/* "What I did" — Finn-bubble explainer in plain English */}
      <div className="flex items-start gap-3">
        <span
          className="relative h-6 w-6 shrink-0 rounded-full overflow-hidden bg-[var(--card)] ring-1 ring-[var(--border)] mt-0.5"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/AI_Logo.png" alt="" className="h-full w-full object-cover" />
        </span>
        <p className="text-sm text-foreground leading-relaxed flex-1">
          <span className="font-medium">What I did:</span> {explainer}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <MetaCard label="What I saw">
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

        <MetaCard label="What you said">
          <p className="text-sm text-foreground italic leading-relaxed line-clamp-6">
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

      {/* What's next — actions sized to the verdict */}
      <div className="grid gap-3 md:grid-cols-2">
        {approved && (
          <>
            <NextCard
              eyebrow="What's next"
              title="Book a repair"
              hint="3 partner shops nearby"
              accent
            />
            <NextCard
              eyebrow="If something's off"
              title="Appeal"
              hint="Human review · under 4h"
            />
          </>
        )}
        {escalated && (
          <>
            <NextCard
              eyebrow="What happens now"
              title="A specialist takes over"
              hint="They have everything you sent · decision under 4h"
              accent
            />
            <NextCard
              eyebrow="No need to check in"
              title="We&apos;ll push you"
              hint="Notification when there's an answer"
            />
          </>
        )}
        {rejected && (
          <>
            <NextCard
              eyebrow="Don't agree?"
              title="Appeal to a human"
              hint="A specialist will re-look · under 4h"
              accent
            />
            <NextCard
              eyebrow="Need a hand"
              title="Talk to support"
              hint="Live chat · same conversation"
            />
          </>
        )}
      </div>

      {onNewClaim && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={onNewClaim}
            className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-[var(--accent-contrast)] hover:bg-accent-hover transition-colors"
          >
            File another claim
          </button>
        </div>
      )}
    </section>
  );
}

function whatIDid(d: ClaimResponse["decision"]): string {
  const parts: string[] = [];
  parts.push(`looked at the photo (${d.damage_type})`);
  if (d.matched_payment_id) {
    parts.push(`matched the purchase to bunq payment #${d.matched_payment_id}`);
  } else {
    parts.push("checked your bunq transactions");
  }
  parts.push("applied your policy clause");
  if (d.decision === "approve" && d.payout_eur > 0) {
    if (d.deductible_eur && d.deductible_eur > 0) {
      parts.push(`paid out ${formatEUR(d.payout_eur)} (your ${formatEUR(d.deductible_eur)} deductible kept aside)`);
    } else {
      parts.push(`paid out ${formatEUR(d.payout_eur)}`);
    }
  } else if (d.decision === "escalate") {
    parts.push("flagged it for a specialist with everything pre-filled");
  } else {
    parts.push("written up the reason and an appeal path");
  }
  return parts.join(", then ") + ".";
}

function NextCard({
  eyebrow,
  title,
  hint,
  accent,
}: {
  eyebrow: string;
  title: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? "border-[var(--accent-border)] bg-[var(--accent-subtle)]"
          : "border-[var(--border)] bg-[var(--card)]"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted mb-1.5">
        {eyebrow}
      </p>
      <p className="text-sm font-medium leading-snug">{title}</p>
      <p className="text-[11px] text-muted mt-1 tabular-nums">{hint}</p>
    </div>
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
