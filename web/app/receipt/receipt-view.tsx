"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatEUR, formatDate } from "@/lib/format";

type ReceiptItem = { name: string; price_eur: number };

type Extracted = {
  merchant: string;
  total_eur: number;
  currency: string;
  date: string;
  category: string;
  items: ReceiptItem[];
  confidence: number;
  note: string;
};

type Match = {
  payment_id: number;
  account_id: number;
  amount: number;
  created: string;
  counterparty: string | null;
  description: string;
} | null;

type ProcessResult = { extracted: Extracted; match: Match | { error: string } };

type Stage =
  | { kind: "idle" }
  | { kind: "preview"; preview: string; file: File }
  | { kind: "extracting"; preview: string; file: File }
  | { kind: "ready"; preview: string; file: File; result: ProcessResult }
  | { kind: "saving"; preview: string; file: File; result: ProcessResult }
  | { kind: "saved"; preview: string; result: ProcessResult }
  | { kind: "error"; error: string; preview?: string };

export default function ReceiptView() {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function pickImage(file: File) {
    const preview = URL.createObjectURL(file);
    setStage({ kind: "preview", preview, file });
  }

  async function extract() {
    if (stage.kind !== "preview") return;
    setStage({ ...stage, kind: "extracting" });
    const form = new FormData();
    form.append("image", stage.file);
    try {
      const r = await fetch("/api/receipt", { method: "POST", body: form });
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        throw new Error(`${r.status} ${detail.slice(0, 200)}`);
      }
      const result = (await r.json()) as ProcessResult;
      setStage({ kind: "ready", preview: stage.preview, file: stage.file, result });
    } catch (err) {
      setStage({
        kind: "error",
        error: err instanceof Error ? err.message : String(err),
        preview: stage.preview,
      });
    }
  }

  async function confirm() {
    if (stage.kind !== "ready") return;
    const match = stage.result.match;
    if (!match || "error" in match) return;
    setStage({ ...stage, kind: "saving" });
    try {
      const r = await fetch("/api/receipt/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: match.payment_id,
          extracted: stage.result.extracted,
        }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      setStage({ kind: "saved", preview: stage.preview, result: stage.result });
      router.refresh();
    } catch (err) {
      setStage({
        kind: "error",
        error: err instanceof Error ? err.message : String(err),
        preview: stage.preview,
      });
    }
  }

  function reset() {
    if ("preview" in stage && stage.preview) URL.revokeObjectURL(stage.preview);
    setStage({ kind: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      {stage.kind === "idle" ? (
        <DropZone onFile={pickImage} onButtonClick={() => fileInputRef.current?.click()} />
      ) : (
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <figure className="rounded-xl border border-[var(--border)] overflow-hidden bg-white dark:bg-black">
            {"preview" in stage && stage.preview && (
              <img src={stage.preview} alt="Receipt preview" className="w-full h-full object-cover max-h-[420px]" />
            )}
          </figure>

          <div className="space-y-4 min-w-0">
            {stage.kind === "preview" && <PreviewActions onExtract={extract} onReset={reset} />}
            {stage.kind === "extracting" && <ExtractingState />}
            {stage.kind === "ready" && (
              <ResultView result={stage.result} onConfirm={confirm} onReset={reset} />
            )}
            {stage.kind === "saving" && <SavingState />}
            {stage.kind === "saved" && <SavedView result={stage.result} onReset={reset} />}
            {stage.kind === "error" && <ErrorView error={stage.error} onReset={reset} />}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickImage(f);
        }}
        className="sr-only"
      />
    </div>
  );
}

function DropZone({
  onFile,
  onButtonClick,
}: {
  onFile: (f: File) => void;
  onButtonClick: () => void;
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
      className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
        hover
          ? "border-accent bg-accent/5"
          : "border-[var(--border)] hover:border-accent/40"
      }`}
    >
      <div className="mx-auto max-w-xs space-y-3">
        <div className="mx-auto h-10 w-10 rounded-full bg-accent/15 flex items-center justify-center text-accent text-lg" aria-hidden>
          +
        </div>
        <p className="text-sm leading-relaxed">
          <span className="font-medium">Drop a receipt here</span>, paste one, or{" "}
          <button
            type="button"
            onClick={onButtonClick}
            className="underline underline-offset-2 hover:text-accent transition-colors"
          >
            pick / take a photo
          </button>
          .
        </p>
        <p className="text-xs text-muted">JPEG, PNG, WebP, HEIC · up to 6 MB</p>
      </div>
    </div>
  );
}

function PreviewActions({
  onExtract,
  onReset,
}: {
  onExtract: () => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5">
      <h3 className="font-medium">Ready to read</h3>
      <p className="text-sm text-muted mt-1 leading-relaxed">
        Teller will extract the merchant, total, and items, then try to match the transaction on your bunq account.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onExtract}
          className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Extract with Claude
        </button>
        <button onClick={onReset} className="text-sm text-muted hover:text-foreground transition-colors">
          Pick another
        </button>
      </div>
    </div>
  );
}

function ExtractingState() {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center gap-2 text-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-hidden />
        <span>Reading the receipt…</span>
      </div>
      <p className="text-xs text-muted mt-2">Typically 3–6 seconds.</p>
    </div>
  );
}

function SavingState() {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5">
      <div className="flex items-center gap-2 text-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" aria-hidden />
        <span>Saving the match…</span>
      </div>
    </div>
  );
}

function ResultView({
  result,
  onConfirm,
  onReset,
}: {
  result: ProcessResult;
  onConfirm: () => void;
  onReset: () => void;
}) {
  const { extracted, match } = result;
  const hasMatch = match && !("error" in match);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-wide">{extracted.category}</p>
            <h3 className="text-lg font-medium tracking-tight">{extracted.merchant}</h3>
            {extracted.date && (
              <p className="text-xs text-muted tabular-nums mt-0.5">{extracted.date}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">{formatEUR(extracted.total_eur)}</p>
            <p className="text-xs text-muted tabular-nums">
              confidence {Math.round((extracted.confidence ?? 0) * 100)}%
            </p>
          </div>
        </div>

        {extracted.items.length > 0 && (
          <ul className="text-sm border-t border-[var(--border)] pt-3 space-y-1.5 max-h-48 overflow-y-auto">
            {extracted.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="truncate">{item.name}</span>
                <span className="tabular-nums text-muted">{formatEUR(item.price_eur)}</span>
              </li>
            ))}
          </ul>
        )}

        {extracted.note && (
          <p className="text-xs text-muted border-t border-[var(--border)] pt-3">{extracted.note}</p>
        )}
      </div>

      <MatchCard match={match} onConfirm={onConfirm} onReset={onReset} hasMatch={Boolean(hasMatch)} />
    </div>
  );
}

function MatchCard({
  match,
  onConfirm,
  onReset,
  hasMatch,
}: {
  match: Match | { error: string };
  onConfirm: () => void;
  onReset: () => void;
  hasMatch: boolean;
}) {
  if (!match) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-5">
        <h4 className="font-medium">No matching transaction yet</h4>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          Teller couldn&apos;t find a recent payment on your bunq account that matches this receipt&apos;s amount
          (within €0.02, past 14 days). The receipt data is still extracted — you can try another.
        </p>
        <div className="mt-4">
          <button onClick={onReset} className="text-sm text-muted hover:text-foreground transition-colors">
            Pick another
          </button>
        </div>
      </div>
    );
  }

  if ("error" in match) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-5">
        <h4 className="font-medium">Match failed</h4>
        <p className="text-sm text-muted mt-1 leading-relaxed">{match.error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/60 bg-accent/5 p-5 space-y-3">
      <div>
        <p className="text-xs text-accent uppercase tracking-wide">Match found</p>
        <h4 className="font-medium mt-0.5">
          {match.counterparty ?? "Unknown"}{" "}
          <span className="tabular-nums text-muted text-sm">· {formatEUR(match.amount)}</span>
        </h4>
        <p className="text-xs text-muted tabular-nums mt-0.5">
          {formatDate(match.created)} · payment #{match.payment_id}
        </p>
        {match.description && (
          <p className="text-sm mt-2 text-muted">“{match.description}”</p>
        )}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onConfirm}
          disabled={!hasMatch}
          className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Confirm match
        </button>
        <button onClick={onReset} className="text-sm text-muted hover:text-foreground transition-colors">
          Pick another
        </button>
      </div>
    </div>
  );
}

function SavedView({ result, onReset }: { result: ProcessResult; onReset: () => void }) {
  const match = result.match && !("error" in result.match) ? result.match : null;
  return (
    <div className="rounded-xl border border-accent/60 bg-accent/5 p-5 space-y-3">
      <div>
        <p className="text-xs text-accent uppercase tracking-wide">Saved</p>
        <h4 className="font-medium mt-0.5">
          {result.extracted.merchant} · {result.extracted.category}
        </h4>
        {match && (
          <p className="text-xs text-muted tabular-nums mt-0.5">
            linked to payment #{match.payment_id}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onReset}
          className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 transition-opacity"
        >
          Scan another
        </button>
        <a href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}

function ErrorView({ error, onReset }: { error: string; onReset: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-5">
      <h4 className="font-medium text-red-500">Something went wrong</h4>
      <pre className="text-xs text-muted mt-2 whitespace-pre-wrap font-mono">{error}</pre>
      <button
        onClick={onReset}
        className="mt-4 text-sm text-muted hover:text-foreground transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
