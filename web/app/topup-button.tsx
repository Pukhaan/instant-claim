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
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={topUp}
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "requesting…" : "Request €500"}
      </button>
      {message && <span className="text-xs text-muted tabular-nums">{message}</span>}
    </div>
  );
}
