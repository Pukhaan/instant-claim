import { formatDate, formatEUR } from "@/lib/format";
import TopNav from "../top-nav";
import TopUpButton from "../topup-button";

export const dynamic = "force-dynamic";

type Health = {
  ok: boolean;
  bunq?: { user: { display_name: string | null; user_id: number }; accounts_count: number };
  anthropic_configured?: boolean;
  aws_configured?: boolean;
  aws_services?: Record<string, boolean>;
};

type Account = {
  id: number;
  description: string;
  balance: number | null;
  iban: string | null;
  currency: string;
};

type Transaction = {
  id: number;
  created: string;
  amount: number | null;
  currency: string;
  counterparty: string | null;
  description: string;
  type: string;
  sub_type: string;
};

type Enrichment = { payment_id: number; merchant?: string; category?: string };

const API = process.env.API_BASE_URL || "http://localhost:8000";

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export default async function SandboxPage() {
  const [health, accounts, enrichments] = await Promise.all([
    fetchJson<Health>("/health"),
    fetchJson<Account[]>("/accounts"),
    fetchJson<Record<string, Enrichment>>("/enrichments"),
  ]);

  const primary = accounts?.[0];
  const transactions = primary
    ? (await fetchJson<Transaction[]>(`/accounts/${primary.id}/transactions?count=50`)) ?? []
    : [];
  const enrichmentsMap = enrichments ?? {};

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 md:py-14">
      <TopNav current="sandbox" />

      <SandboxBanner health={health} />

      <section className="mt-8 grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <h1 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1]">
            Sandbox
          </h1>
          <p className="text-pretty mt-3 text-muted max-w-xl leading-relaxed">
            A wide view of the bunq sandbox account Teller is connected to. Everything here is
            test data — the same API surface as production, but safe to poke at.
          </p>
        </div>
        <div className="flex items-end">
          <TopUpButton />
        </div>
      </section>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <IdentityCard health={health} />
        <AccountCard account={primary} enrichmentCount={Object.keys(enrichmentsMap).length} />
      </div>

      <div className="mt-4">
        <FullTransactions transactions={transactions} enrichments={enrichmentsMap} />
      </div>
    </div>
  );
}

function SandboxBanner({ health }: { health: Health | null }) {
  const name = health?.bunq?.user?.display_name ?? "—";
  const id = health?.bunq?.user?.user_id ?? "—";
  return (
    <div className="rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-5 py-3 flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          Sandbox mode
        </span>
        <span className="text-muted">·</span>
        <span className="truncate">
          {name} <span className="text-muted tabular-nums">(user {id})</span>
        </span>
      </div>
      <span className="text-xs text-muted font-mono">public-api.sandbox.bunq.com</span>
    </div>
  );
}

function IdentityCard({ health }: { health: Health | null }) {
  const items = [
    { k: "Anthropic", v: health?.anthropic_configured ? "connected" : "not configured" },
    { k: "AWS", v: health?.aws_configured ? "connected" : "not configured" },
    { k: "Accounts", v: health?.bunq?.accounts_count?.toString() ?? "—" },
  ];
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted mb-3">Identity</h3>
      <dl className="text-sm space-y-2">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">User</dt>
          <dd className="font-medium truncate">{health?.bunq?.user?.display_name ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">User id</dt>
          <dd className="font-mono text-xs tabular-nums">{health?.bunq?.user?.user_id ?? "—"}</dd>
        </div>
        {items.map((i) => (
          <div key={i.k} className="flex items-center justify-between gap-4">
            <dt className="text-muted">{i.k}</dt>
            <dd className="tabular-nums">{i.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AccountCard({
  account,
  enrichmentCount,
}: {
  account: Account | undefined;
  enrichmentCount: number;
}) {
  if (!account) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted mb-3">Account</h3>
        <p className="text-sm text-muted">No active monetary account found.</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted mb-3">
        {account.description || "Account"}
      </h3>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-semibold tabular-nums tracking-tight">
          {formatEUR(account.balance)}
        </div>
        <div className="text-right text-xs text-muted tabular-nums">
          {enrichmentCount} enrichment{enrichmentCount === 1 ? "" : "s"}
        </div>
      </div>
      <div
        className="mt-2 text-xs text-muted font-mono truncate"
        title={account.iban ?? ""}
      >
        {account.iban ?? "—"}
      </div>
    </section>
  );
}

function FullTransactions({
  transactions,
  enrichments,
}: {
  transactions: Transaction[];
  enrichments: Record<string, Enrichment>;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="px-5 pt-5 flex items-baseline justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Transactions</h3>
        <span className="text-xs text-muted tabular-nums">
          {transactions.length} total
        </span>
      </div>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted px-5 py-8 text-center">
          No transactions yet. Request €500 above to seed a bonus.
        </p>
      ) : (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs uppercase tracking-wide border-b border-[var(--border)]">
                <th className="text-left font-medium px-5 py-3">When</th>
                <th className="text-left font-medium px-5 py-3">Counterparty</th>
                <th className="text-left font-medium px-5 py-3">Category</th>
                <th className="text-left font-medium px-5 py-3">Note</th>
                <th className="text-right font-medium px-5 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const enr = enrichments[String(t.id)];
                const name = enr?.merchant || t.counterparty || "—";
                return (
                  <tr
                    key={t.id}
                    className="border-b last:border-b-0 border-[var(--border)] hover:bg-[var(--tint-3)] transition-colors"
                  >
                    <td className="px-5 py-3 tabular-nums text-muted whitespace-nowrap">
                      {formatDate(t.created)}
                    </td>
                    <td className="px-5 py-3 truncate max-w-[200px]">{name}</td>
                    <td className="px-5 py-3">
                      {enr?.category ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-2.5 py-0.5 text-xs text-foreground">
                          <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
                          {enr.category}
                        </span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 truncate max-w-[260px] text-muted">
                      {t.description || "—"}
                    </td>
                    <td
                      className={`px-5 py-3 text-right tabular-nums font-medium whitespace-nowrap ${
                        (t.amount ?? 0) < 0 ? "" : "text-accent"
                      }`}
                    >
                      {formatEUR(t.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
