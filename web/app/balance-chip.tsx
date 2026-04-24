import { headers } from "next/headers";

type Account = {
  id: number;
  description: string;
  balance: number | null;
  currency?: string;
};

async function fetchPrimaryAccount(): Promise<Account | null> {
  try {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const res = await fetch(`${proto}://${host}/api/accounts`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const accounts: Account[] = await res.json();
    // Primary = first active account (bunq returns them in priority order).
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

function formatEUR(value: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function BalanceChip() {
  const account = await fetchPrimaryAccount();
  if (!account || account.balance == null) return null;

  const amount = formatEUR(account.balance, account.currency ?? "EUR");

  return (
    <div
      className="flex items-center gap-2 rounded-full bg-[var(--card)] ring-1 ring-[var(--border)] px-3 py-1.5 shadow-sm"
      aria-label={`Primary account balance: ${amount}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      <span className="text-[11px] uppercase tracking-[0.08em] text-muted font-medium">
        Balance
      </span>
      <span className="text-sm font-semibold tabular-nums tracking-tight">{amount}</span>
    </div>
  );
}
