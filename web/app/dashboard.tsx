import { formatDate, formatEUR } from "@/lib/format";
import TopUpButton from "./topup-button";

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

type Enrichment = {
  payment_id: number;
  merchant?: string;
  category?: string;
  total_eur?: number;
};

type Enrichments = Record<string, Enrichment>;

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

export default async function Dashboard() {
  const health = await fetchJson<Health>("/health");
  const accounts = (await fetchJson<Account[]>("/accounts")) ?? [];
  const primary = accounts[0];
  const [transactions, enrichments] = await Promise.all([
    primary
      ? fetchJson<Transaction[]>(`/accounts/${primary.id}/transactions?count=6`)
      : Promise.resolve([]),
    fetchJson<Enrichments>("/enrichments"),
  ]);
  const enrichmentsMap = enrichments ?? {};

  if (!health?.ok) {
    return (
      <Card>
        <h3 className="font-medium">API unreachable</h3>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          Start the backend with{" "}
          <code className="font-mono text-xs bg-[var(--input)] px-1.5 py-0.5 rounded">
            uvicorn app.main:app --reload --port 8000
          </code>{" "}
          from the <code className="font-mono text-xs">api/</code> directory.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard health={health} />
        <AccountCard account={primary} accountsTotal={accounts.length} />
        <ActionCard anthropicReady={Boolean(health.anthropic_configured)} />
      </div>

      <TransactionsTable transactions={transactions ?? []} enrichments={enrichmentsMap} />
    </div>
  );
}

function StatusCard({ health }: { health: Health }) {
  const aws = health.aws_services ?? {};
  const primary = [
    { label: "bunq sandbox", ok: Boolean(health.bunq) },
    { label: "Anthropic", ok: Boolean(health.anthropic_configured) },
    { label: "AWS credentials", ok: Boolean(health.aws_configured) },
  ];
  const awsItems = (["bedrock", "transcribe", "polly", "s3"] as const).map((k) => ({
    label: k,
    ok: Boolean(aws[k]),
  }));
  return (
    <Card title="Status">
      <ul className="text-sm space-y-2.5">
        {primary.map((i) => (
          <li key={i.label} className="flex items-center gap-2.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${i.ok ? "bg-accent" : "bg-[var(--tint-8)]"}`}
              aria-hidden
            />
            <span className={i.ok ? "" : "text-muted"}>{i.label}</span>
            <span className="ml-auto text-xs text-muted tabular-nums">
              {i.ok ? "connected" : "not configured"}
            </span>
          </li>
        ))}
      </ul>
      {health.aws_configured && (
        <ul className="mt-4 pt-3 border-t border-[var(--border)] text-xs space-y-2 text-muted">
          {awsItems.map((i) => (
            <li key={i.label} className="flex items-center gap-2.5">
              <span
                className={`h-1 w-1 rounded-full ${i.ok ? "bg-accent" : "bg-[var(--tint-7)]"}`}
                aria-hidden
              />
              <span className="lowercase">{i.label}</span>
              <span className="ml-auto tabular-nums">{i.ok ? "ok" : "denied"}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AccountCard({
  account,
  accountsTotal,
}: {
  account: Account | undefined;
  accountsTotal: number;
}) {
  if (!account) {
    return (
      <Card title="No account">
        <p className="text-sm text-muted leading-relaxed">No active monetary account found.</p>
      </Card>
    );
  }
  return (
    <Card title={account.description || "Account"}>
      <div className="text-3xl font-semibold tabular-nums tracking-tight">
        {formatEUR(account.balance)}
      </div>
      <div
        className="mt-2 text-xs text-muted font-mono truncate"
        title={account.iban ?? ""}
      >
        {account.iban ?? "—"}
      </div>
      <div className="mt-3 text-xs text-muted">
        {accountsTotal} active account{accountsTotal === 1 ? "" : "s"}
      </div>
    </Card>
  );
}

function ActionCard({ anthropicReady }: { anthropicReady: boolean }) {
  return (
    <Card title="Talk to Teller">
      {anthropicReady ? (
        <>
          <p className="text-sm text-muted leading-relaxed">
            Ask about balances, move money, split a bonus, or scan a receipt.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href="/chat"
              className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-[var(--accent-contrast)] hover:bg-accent-hover transition-colors"
            >
              Open chat
            </a>
            <a
              href="/receipt"
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-4 text-sm font-medium hover:border-[var(--accent-border)] hover:bg-[var(--accent-subtle)] transition-colors"
            >
              Scan receipt
            </a>
            <TopUpButton />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted leading-relaxed">
            Set <span className="font-mono text-xs">ANTHROPIC_API_KEY</span> in{" "}
            <span className="font-mono text-xs">api/.env</span> to enable chat and receipts.
          </p>
          <div className="mt-4">
            <TopUpButton />
          </div>
        </>
      )}
    </Card>
  );
}

function TransactionsTable({
  transactions,
  enrichments,
}: {
  transactions: Transaction[];
  enrichments: Enrichments;
}) {
  return (
    <Card title="Recent transactions" compact>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted px-5 pb-5">No transactions yet. Top up to see one appear.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs uppercase tracking-wide border-b border-[var(--border)]">
                <th className="text-left font-medium px-5 py-3">When</th>
                <th className="text-left font-medium px-5 py-3">Counterparty</th>
                <th className="text-left font-medium px-5 py-3">Detail</th>
                <th className="text-right font-medium px-5 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const enr = enrichments[String(t.id)];
                const display = enr?.merchant || t.counterparty || "—";
                return (
                  <tr
                    key={t.id}
                    className="border-b last:border-b-0 border-[var(--border)] hover:bg-[var(--tint-3)] transition-colors"
                  >
                    <td className="px-5 py-3 tabular-nums text-muted">{formatDate(t.created)}</td>
                    <td className="px-5 py-3 truncate max-w-[180px]">{display}</td>
                    <td className="px-5 py-3 truncate max-w-[260px]">
                      {enr?.category ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-2.5 py-0.5 text-xs text-foreground">
                          <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
                          {enr.category}
                        </span>
                      ) : (
                        <span className="text-muted">{t.description || "—"}</span>
                      )}
                    </td>
                    <td
                      className={`px-5 py-3 text-right tabular-nums font-medium ${
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
    </Card>
  );
}

function Card({
  title,
  children,
  compact,
}: {
  title?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xs hover:shadow-sm transition-shadow">
      {title && (
        <h3
          className={`text-xs font-medium uppercase tracking-wider text-muted ${
            compact ? "px-5 pt-5 pb-3" : "px-5 pt-5"
          }`}
        >
          {title}
        </h3>
      )}
      <div className={compact ? "" : "px-5 pb-5 pt-3"}>{children}</div>
    </section>
  );
}
