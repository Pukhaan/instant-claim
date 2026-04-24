"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function TopUpButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function topUp() {
    setMessage(null);
    try {
      const r = await fetch("/api/sandbox/topup", { method: "POST" });
      if (!r.ok) throw new Error(`${r.status}`);
      setMessage("+ €500 requested");
      startTransition(() => router.refresh());
    } catch (err) {
      setMessage(`failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={topUp}
        disabled={pending}
        className="inline-flex h-9 items-center rounded-full border border-[var(--border)] px-4 text-sm font-medium hover:border-[var(--border-strong)] hover:bg-[var(--input)] transition-colors disabled:opacity-50"
      >
        {pending ? "requesting…" : "Request €500"}
      </button>
      {message && <span className="text-xs text-muted tabular-nums">{message}</span>}
    </div>
  );
}
