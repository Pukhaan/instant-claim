// / — the bunq-style home screen, our main entry point.
//
// Mirrors the "01 - home" frame from the Finn-Insurance Figma 1:1 with real
// data from the seeded bunq sandbox: live balance, real account, real
// recent transactions. Tap "Start a Claim" to launch /claim.
//
// The chat-first interface still lives at /chat for the original flow.

import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

// Server action — Sugar-Daddy top-up wired to the bunq sandbox.
// Submitting the Add Money form posts here, requests €500 from Sugar Daddy
// (the sandbox's faucet), then revalidates the page so the balance + recent
// transactions refresh on the next render.
async function topUp() {
  "use server";
  try {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    await fetch(`${proto}://${host}/api/sandbox/topup?amount_eur=500`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Best-effort — if it fails we just don't refresh.
  }
  revalidatePath("/");
}

type Account = {
  id: number;
  description: string;
  balance: number | null;
  iban: string;
  currency: string;
};

type Transaction = {
  id: number;
  amount: number | null;
  counterparty: string | null;
  description: string | null;
  created: string | null;
};

async function api<T>(path: string): Promise<T | null> {
  try {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const r = await fetch(`${proto}://${host}/api/${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function fmtMoney(value: number, currency = "EUR") {
  // Figma uses comma decimal, dot thousands (Dutch style): € 13.900,00
  const major = Math.floor(Math.abs(value));
  const minor = Math.round((Math.abs(value) - major) * 100)
    .toString()
    .padStart(2, "0");
  const sign = value < 0 ? "-" : "";
  const symbol = currency === "EUR" ? "€" : currency;
  const grouped = major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return { symbol, sign, major: grouped, minor };
}

export default async function HomePage() {
  const accounts = (await api<Account[]>("accounts")) ?? [];
  const primary = accounts[0] ?? null;
  const balance = primary?.balance ?? 0;
  const txs = primary
    ? ((await api<Transaction[]>(`accounts/${primary.id}/transactions?count=4`)) ?? [])
    : [];

  const wealth = fmtMoney(balance);
  const mainBal = fmtMoney(balance);

  return (
    <div className="snap min-h-[100dvh] w-full bg-[var(--finn-bg)] pb-8" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-[17px] px-[18px] pt-5">
        {/* Header — avatar + name + QR. Avatar PNG has the magenta ring +
            bunq-Elite crown badge baked in, so we render it as one image. */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/Avatar.png"
              alt="Valeriu"
              width={48}
              height={48}
              priority
              className="h-12 w-12 shrink-0 object-contain"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-[#f0a]">bunq Elite</span>
              <span className="text-[15px] font-semibold text-white">Valeriu</span>
            </div>
          </div>
          <button
            aria-label="Show QR code"
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/70"
          >
            <QrIcon />
          </button>
        </header>

        <h1 className="text-[34px] font-extrabold leading-[36px] tracking-tight text-[var(--finn-text)]">
          Home
        </h1>

        {/* Net wealth card */}
        <div className="relative rounded-[16px] bg-[var(--finn-card)] px-3 py-4 text-center">
          <p className="text-[13px] font-semibold text-[var(--finn-muted)]">Net Wealth</p>
          <p className="mt-2 tabular-nums text-white">
            <span className="text-[30px] font-extrabold">{wealth.symbol} </span>
            <span className="text-[30px] font-extrabold">
              {wealth.sign}
              {wealth.major}
            </span>
            <span className="text-[30px] font-extrabold">,</span>
            <span className="text-[19.35px] font-extrabold">{wealth.minor}</span>
          </p>
          <p className="mt-2 text-[13px] font-bold text-[var(--finn-muted)]">
            {"\u{1F4A1}"} ApeCoin is up by 79.40% today
          </p>
          <span aria-hidden className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--finn-muted)]">
            <ChevronRight />
          </span>
        </div>

        {/* Action row — Pay / Request / Add Money. Add Money is wired to the
            Sugar-Daddy faucet so the demo can refill in one tap. */}
        <div className="flex items-stretch gap-2.5">
          <ActionButton tone="orange" icon={<UpArrow />}>
            Pay
          </ActionButton>
          <ActionButton tone="blue" icon={<DownArrow />}>
            Request
          </ActionButton>
          <form action={topUp} className="flex flex-1">
            <ActionButton tone="purple" icon={<PlusIcon />} type="submit">
              Add Money
            </ActionButton>
          </form>
        </div>

        {/* Bank Accounts section */}
        <section className="flex flex-col gap-1">
          <SectionLabel>Bank Accounts</SectionLabel>
          <div className="rounded-[16px] bg-[var(--finn-card)] p-2">
            <div className="flex items-center justify-between border-b border-[var(--finn-separator)] px-2 pb-3 pt-0.5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#044127]">
                  <WalletIcon />
                </div>
                <p className="text-[18px] font-medium text-[var(--finn-text)]">
                  {primary?.description ?? "Main"}
                </p>
              </div>
              <p className="tabular-nums text-white">
                <span className="text-[17px] font-extrabold">€ {mainBal.major},</span>
                <span className="text-[10.965px] font-extrabold">{mainBal.minor}</span>
              </p>
            </div>
            <button className="w-full px-2 py-2 text-left text-[16px] font-bold text-[#0096ff] active:opacity-60">
              Add An Extra Bank Account
            </button>
          </div>
        </section>

        {/* Your Travel — Finn entry point */}
        <section className="flex flex-col gap-1">
          <SectionLabel>Your Travel</SectionLabel>
          <div className="flex flex-col items-center gap-3 rounded-[16px] bg-[var(--finn-card)] px-3 py-4 text-center">
            <Image
              src="/AI_Logo.png"
              alt="Finn"
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
              priority
            />
            <div>
              <p className="text-[16px] font-semibold text-white">
                Something Happened? No worries!
              </p>
              <p className="mt-1 text-[13px] font-bold leading-[15px] text-[var(--finn-muted)]">
                Finn, your assistant, will walk you through it. Photo, voice note, done. Usually
                settled in under a minute.
              </p>
            </div>
            <Link
              href="/claim"
              className="py-1 text-[16px] font-bold text-[#0096ff] active:opacity-60"
            >
              Start a Claim
            </Link>
          </div>
        </section>

        {/* Recent transactions — pulled live from the bunq sandbox */}
        <section className="flex flex-col gap-1">
          <SectionLabel>Recent Transactions</SectionLabel>
          <div className="rounded-[16px] bg-[var(--finn-card)] p-2">
            {txs.slice(0, 3).map((t, i, arr) => {
              const amt = fmtMoney(t.amount ?? 0);
              const last = i === Math.min(arr.length, 3) - 1;
              const initial = (t.counterparty || t.description || "?").trim().charAt(0).toUpperCase();
              const isOut = (t.amount ?? 0) < 0;
              return (
                <div
                  key={t.id}
                  className={`flex items-center justify-between px-2 pb-3 pt-0.5 ${
                    last ? "" : "border-b border-[var(--finn-separator)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[27px] bg-white">
                      <span className="text-[19px] font-extrabold text-black">{initial}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 leading-tight">
                      <p className="text-[18px] font-medium text-[var(--finn-text)]">
                        {t.counterparty ?? t.description ?? "Payment"}
                      </p>
                      <p className="text-[14px] font-medium text-[var(--finn-muted)]">
                        {t.description ?? "Online Payment"}
                      </p>
                    </div>
                  </div>
                  <p className="tabular-nums text-[var(--finn-orange)]">
                    <span className="text-[17px] font-extrabold">
                      € {isOut ? "-" : ""}
                      {amt.major},
                    </span>
                    <span className="text-[10.965px] font-extrabold">{amt.minor}</span>
                  </p>
                </div>
              );
            })}
            {txs.length === 0 && (
              <p className="px-3 py-4 text-center text-[13px] text-[var(--finn-muted)]">
                No recent activity yet. Tap a category in the claim flow to seed some.
              </p>
            )}
            <button className="w-full px-2 py-2 text-left text-[16px] font-bold text-[#0096ff] active:opacity-60">
              See all
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-1 text-[18px] font-bold text-[var(--finn-text)]">{children}</p>
  );
}

function ActionButton({
  children,
  tone,
  icon,
  type = "button",
}: {
  children: React.ReactNode;
  tone: "orange" | "blue" | "purple";
  icon: React.ReactNode;
  type?: "button" | "submit";
}) {
  const colors =
    tone === "orange"
      ? { bg: "#66300a", border: "#ff7819", dot: "#ff7819" }
      : tone === "blue"
        ? { bg: "#003666", border: "#08f", dot: "#08f" }
        : { bg: "#580566", border: "#a22fb6", dot: "#a22fb6" };
  return (
    <button
      type={type}
      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[16px] border-2 text-[13px] font-extrabold leading-none text-white active:scale-[0.98] active:opacity-80 transition-all"
      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
    >
      <span
        aria-hidden
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-white"
        style={{ background: colors.dot }}
      >
        {icon}
      </span>
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3M21 14v3M14 21v-4M17 21h4" />
    </svg>
  );
}

function UpArrow() {
  return (
    <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 11V3M3 7l4-4 4 4" />
    </svg>
  );
}

function DownArrow() {
  return (
    <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 3v8M3 7l4 4 4-4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d795" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8z" />
      <path d="M3 8V6a2 2 0 0 1 2-2h11" />
      <circle cx="16" cy="14" r="1.4" fill="#34d795" />
    </svg>
  );
}
