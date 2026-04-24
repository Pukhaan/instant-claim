import { formatDate, formatEUR } from "@/lib/format";
import TopUpButton from "./topup-button";

type Health = {
  ok: boolean;
  bunq?: { user: { display_name: string | null; user_id: number }; accounts_count: number };
  anthropic_configured?: boolean;
  aws_configured?: boolean;
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
  const transactions = primary
    ? (await fetchJson<Transaction[]>(`/accounts/${primary.id}/transactions?count=6`)) ?? []
    : [];

  if (!health?.ok) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-6">
        <h3 className="font-medium">API unreachable</h3>
        <p className="text-muted text-sm mt-2">
          Start the backend with{" "}
          <code className="font-mono text-xs bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">
            uvicorn app.main:app --reload --port 8000
          </code>{" "}
          from the <code className="font-mono text-xs">api/</code> directory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <StatusCard health={health} />
        <AccountCard account={primary} accountsTotal={accounts.length} />
        <ActionCard anthropicReady={Boolean(health.anthropic_configured)} />
      </div>

      <TransactionsTable transactions={transactions} />
    </div>
  );
}

function StatusCard({ health }: { health: Health }) {
  const items = [
    { label: "bunq sandbox", ok: Boolean(health.bunq) },
    { label: "Anthropic", ok: Boolean(health.anthropic_configured) },
    { label: "AWS (S3/Transcribe/Polly)", ok: Boolean(health.aws_configured) },
  ];
  return (
    <Card title="Status">
      <ul className="text-sm space-y-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${i.ok ? "bg-accent" : "bg-zinc-400"}`}
              aria-hidden
            />
            <span className={i.ok ? "" : "text-muted"}>{i.label}</span>
            <span className="ml-auto text-xs text-muted tabular-nums">
              {i.ok ? "connected" : "not configured"}
            </span>
          </li>
        ))}
      </ul>
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
  if (!account) return <Card title="No account">No active monetary account found.</Card>;
  return (
    <Card title={account.description || "Account"}>
      <div className="text-3xl font-semibold tabular-nums tracking-tight">
        {formatEUR(account.balance)}
      </div>
      <div className="mt-2 text-xs text-muted font-mono truncate" title={account.iban ?? ""}>
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
            Ask about balances, move money, or split a bonus in plain language.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <a
              href="/chat"
              className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Open chat
            </a>
            <TopUpButton />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted leading-relaxed">
            Set <span className="font-mono text-xs">ANTHROPIC_API_KEY</span> in{" "}
            <span className="font-mono text-xs">api/.env</span> and restart the backend to enable chat.
          </p>
          <div className="mt-4">
            <TopUpButton />
          </div>
        </>
      )}
    </Card>
  );
}

function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card title="Recent transactions">
      {transactions.length === 0 ? (
        <p className="text-sm text-muted">No transactions yet. Top up to see one appear.</p>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs uppercase tracking-wide">
                <th className="text-left font-medium px-6 py-2">When</th>
                <th className="text-left font-medium px-6 py-2">Counterparty</th>
                <th className="text-left font-medium px-6 py-2">Description</th>
                <th className="text-right font-medium px-6 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-[var(--border)]">
                  <td className="px-6 py-2.5 tabular-nums text-muted">{formatDate(t.created)}</td>
                  <td className="px-6 py-2.5 truncate max-w-[180px]">{t.counterparty ?? "—"}</td>
                  <td className="px-6 py-2.5 truncate max-w-[260px] text-muted">{t.description}</td>
                  <td
                    className={`px-6 py-2.5 text-right tabular-nums font-medium ${
                      (t.amount ?? 0) < 0 ? "" : "text-accent"
                    }`}
                  >
                    {formatEUR(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-white dark:bg-black p-6">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}
