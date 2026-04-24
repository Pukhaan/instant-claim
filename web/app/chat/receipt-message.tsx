"use client";

import Image from "next/image";
import { useState } from "react";
import { formatDate, formatEUR } from "@/lib/format";
import { confirmReceipt, type ProcessReceipt } from "@/lib/receipt";

export type ReceiptMessageState =
  | { phase: "reading" }
  | { phase: "ready"; result: ProcessReceipt }
  | { phase: "saving"; result: ProcessReceipt }
  | { phase: "saved"; result: ProcessReceipt }
  | { phase: "error"; error: string };

export default function ReceiptMessage({ state }: { state: ReceiptMessageState }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="flex-1 min-w-0 space-y-2 pt-0.5">
        {state.phase === "reading" && <ReadingCard />}
        {state.phase === "ready" && <ReadyCard result={state.result} />}
        {state.phase === "saving" && <SavingCard result={state.result} />}
        {state.phase === "saved" && <SavedCard result={state.result} />}
        {state.phase === "error" && <ErrorCard error={state.error} />}
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent mb-1.5">
      {children}
    </p>
  );
}

function ReadingCard() {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <Label>Reading receipt</Label>
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="inline-flex items-center gap-1 text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint-8)] animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint-8)] animate-pulse [animation-delay:200ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint-8)] animate-pulse [animation-delay:400ms]" />
        </span>
        <span>Claude Vision is extracting merchant, total, and line items…</span>
      </div>
    </section>
  );
}

function ReadyCard({ result }: { result: ProcessReceipt }) {
  const { extracted, match } = result;
  const matched = match && !("error" in match) ? match : null;
  return (
    <>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <Label>What I see</Label>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{extracted.merchant}</p>
            <p className="text-xs text-muted tabular-nums mt-0.5">
              {extracted.date || "date unknown"} · {extracted.category}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-semibold tabular-nums">
              {formatEUR(-Math.abs(extracted.total_eur))}
            </p>
            <p className="text-[11px] text-muted tabular-nums">
              {Math.round((extracted.confidence ?? 0) * 100)}% confident
            </p>
          </div>
        </div>
        {extracted.items.length > 0 && (
          <ul className="text-xs mt-3 pt-3 border-t border-[var(--border)] space-y-1 max-h-32 overflow-y-auto">
            {extracted.items.slice(0, 8).map((item, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="truncate text-foreground">{item.name}</span>
                <span className="tabular-nums text-muted">{formatEUR(item.price_eur)}</span>
              </li>
            ))}
            {extracted.items.length > 8 && (
              <li className="text-muted">+ {extracted.items.length - 8} more</li>
            )}
          </ul>
        )}
      </section>

      <MatchCard result={result} match={matched} />
    </>
  );
}

function MatchCard({
  result,
  match,
}: {
  result: ProcessReceipt;
  match: ReceiptMatch | null;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!match) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <Label>No match yet</Label>
        <p className="text-sm text-muted leading-relaxed">
          I couldn&apos;t find a matching bunq transaction (amount within €0.02, past 14 days). The
          receipt data is still saved if you want to reuse it.
        </p>
      </section>
    );
  }

  async function onSave() {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    setError(null);
    try {
      await confirmReceipt(match!.payment_id, result.extracted);
      setState("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  return (
    <section className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-4 py-3">
      <Label>Match found</Label>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{match.counterparty ?? "Unknown"}</p>
          <p className="text-xs text-muted tabular-nums mt-0.5">
            {formatDate(match.created)} · payment #{match.payment_id}
          </p>
        </div>
        <p className="text-lg font-semibold tabular-nums shrink-0">{formatEUR(match.amount)}</p>
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--accent-border)]/60">
        {state === "saved" ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Saved
          </span>
        ) : (
          <button
            onClick={onSave}
            disabled={state === "saving"}
            className="inline-flex h-8 items-center rounded-full bg-accent px-3 text-xs font-medium text-[var(--accent-contrast)] hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {state === "saving" ? "Saving…" : "Save this match"}
          </button>
        )}
        {error && <span className="text-xs text-[var(--danger)] truncate">{error}</span>}
      </div>
    </section>
  );
}

function SavingCard({ result }: { result: ProcessReceipt }) {
  return <ReadyCard result={result} />;
}

function SavedCard({ result }: { result: ProcessReceipt }) {
  const match = result.match && !("error" in result.match) ? result.match : null;
  return (
    <section className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-4 py-3">
      <Label>Saved</Label>
      <p className="text-sm">
        <span className="font-medium">{result.extracted.merchant}</span>
        {" "}
        · {result.extracted.category}
        {match && (
          <span className="text-muted"> · linked to payment #{match.payment_id}</span>
        )}
      </p>
    </section>
  );
}

function ErrorCard({ error }: { error: string }) {
  return (
    <section className="rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3">
      <Label>Couldn&apos;t read the receipt</Label>
      <pre className="text-xs text-muted font-mono whitespace-pre-wrap">{error}</pre>
    </section>
  );
}

type ReceiptMatch = Extract<
  NonNullable<ProcessReceipt["match"]>,
  { payment_id: number }
>;
