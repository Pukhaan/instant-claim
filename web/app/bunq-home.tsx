"use client";

// bunq-style home — matches the Finn-Insurance Figma node 17:195 1:1.
// Dark canvas, SF Pro Rounded, three coloured action pills, a Net Wealth card,
// the Bank Accounts list, and a SnapClaim entry that routes to /claim.

import Link from "next/link";

export default function BunqHome() {
  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)",
      }}
    >
      {/* Top section — profile row + Home title + Net Wealth + actions */}
      <div className="px-5 pt-4">
        <ProfileRow />

        <h1 className="mt-4 text-[34px] font-extrabold leading-[1.05] tracking-tight text-[#f5f7fa]">
          Home
        </h1>

        <NetWealthCard amount="33.910" cents="00" hint="ApeCoin is up by 79.40% today" />

        <div className="mt-4 flex gap-3">
          <ActionPill label="Pay" tone="orange" direction="up" />
          <ActionPill label="Request" tone="blue" direction="down" />
          <ActionPill label="Add Money" tone="purple" direction="right" />
        </div>
      </div>

      <BankAccounts />

      <SnapClaimEntry />

      <TabBar />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Profile row — circular avatar + greeting + QR code button
// ────────────────────────────────────────────────────────────────────────────

function ProfileRow() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[#ac626c] bg-gradient-to-br from-[#ac626c] to-[#5a2630] text-[18px] font-bold text-white">
          V
        </div>
        <div className="text-[13px] font-semibold leading-[15px]">
          <p className="text-[#98989f]">Good evening,</p>
          <p className="text-white">Valeriu</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Scan QR"
        className="flex h-8 w-8 items-center justify-center text-white active:opacity-60"
      >
        <QRIcon />
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Net Wealth card
// ────────────────────────────────────────────────────────────────────────────

function NetWealthCard({
  amount,
  cents,
  hint,
}: {
  amount: string;
  cents: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      className="relative mt-5 flex w-full flex-col items-center justify-center gap-3 rounded-2xl bg-[#1c1c1e] px-3 py-4 active:opacity-90"
    >
      <p className="text-[13px] font-semibold leading-[15px] text-[#98989f]">
        Net Wealth
      </p>
      <p className="text-center font-extrabold leading-[1.2] tracking-tight text-white">
        <span className="text-[30px]">€&nbsp;</span>
        <span className="text-[30px]">{amount}</span>
        <span className="text-[30px]">,</span>
        <span className="text-[19px]">{cents}</span>
      </p>
      <p className="text-[13px] font-bold leading-[15px] text-[#98989f]">
        💡 {hint}
      </p>
      <ChevronRight className="absolute right-1 top-1/2 -translate-y-1/2 text-[#98989f]" />
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Action pill — Pay / Request / Add Money
// ────────────────────────────────────────────────────────────────────────────

function ActionPill({
  label,
  tone,
  direction,
}: {
  label: string;
  tone: "orange" | "blue" | "purple";
  direction: "up" | "down" | "right";
}) {
  const styles = {
    orange: { bg: "#66300a", border: "#ff7819", icon: "#ff7819" },
    blue: { bg: "#003666", border: "#08f", icon: "#08f" },
    purple: { bg: "#580566", border: "#a22fb6", icon: "#a22fb6" },
  }[tone];

  const arrow =
    direction === "up" ? "rotate-0" : direction === "down" ? "rotate-180" : "rotate-90";

  return (
    <button
      type="button"
      className="flex h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-3 active:opacity-80"
      style={{ background: styles.bg, borderColor: styles.border }}
    >
      <span
        className="flex h-[14px] w-[14px] items-center justify-center rounded-[12px]"
        style={{ background: styles.icon }}
      >
        <ArrowUp className={`h-[9px] w-[9px] text-white ${arrow}`} />
      </span>
      <span className="text-[13px] font-extrabold tracking-tight text-white">
        {label}
      </span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Bank Accounts section
// ────────────────────────────────────────────────────────────────────────────

function BankAccounts() {
  return (
    <section className="mt-7 px-5">
      <h2 className="px-4 text-[18px] font-bold leading-[1.2] text-[#f5f7fa]">
        Bank Accounts
      </h2>
      <div className="mt-2 rounded-2xl bg-[#1c1c1e] p-2">
        <div className="flex items-center justify-between border-b border-[#464646] p-2">
          <div className="flex items-center gap-3">
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-[15px] bg-[#044127]">
              <WalletIcon className="h-7 w-7 text-[#1ae29b]" />
            </div>
            <p className="text-[18px] font-medium leading-[1.2] text-[#f5f7fa]">Main</p>
          </div>
          <p className="text-[17px] font-extrabold tracking-tight text-white">
            <span>€ 13.900,</span>
            <span className="text-[11px]">00</span>
          </p>
        </div>
        <button
          type="button"
          className="w-full p-2 text-center text-[16px] font-bold leading-[15px] text-[#0096ff] active:opacity-60"
        >
          Add An Extra Bank Account
        </button>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SnapClaim entry — the demo's hero CTA, routes to /claim
// ────────────────────────────────────────────────────────────────────────────

function SnapClaimEntry() {
  return (
    <section className="mt-5 px-5">
      <Link
        href="/claim"
        className="relative block overflow-hidden rounded-2xl border border-[rgba(168,219,69,0.35)] bg-[#12151a] active:opacity-90"
      >
        {/* Lime left strip */}
        <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#a8db45]" />
        <div className="px-6 py-5 pr-[112px]">
          <span className="inline-flex items-center justify-center rounded-full bg-[rgba(168,219,69,0.18)] px-3 py-1">
            <span className="text-[10px] font-black uppercase tracking-[0.8px] text-[#a8db45]">
              New
            </span>
          </span>
          <h3 className="mt-2 text-[22px] font-bold leading-[1.2] tracking-tight text-white">
            Something happen?
          </h3>
          <p className="mt-1 text-[13px] leading-[18px] text-[#8c99a6]">
            Snap a photo. Tell Finn what happened.
            <br />
            Get paid in 30s.
          </p>
        </div>

        {/* Lime icon + caption stacked on the right */}
        <div className="absolute right-5 top-7 flex flex-col items-center">
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#a8db45]">
            <BoltIcon className="h-7 w-7 text-[#05070a]" />
          </div>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.44px] text-[#a8db45]">
            SnapClaim
          </p>
        </div>
      </Link>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// bunq tab bar — fixed to bottom, blurred surface, 5 destinations
// ────────────────────────────────────────────────────────────────────────────

function TabBar() {
  const items = [
    { label: "Home", icon: <HomeGlyph />, active: true },
    { label: "Cards", icon: <CardsGlyph />, active: false },
    { label: "Savings", icon: <SavingsGlyph />, active: false },
    { label: "Stocks", icon: <StocksGlyph />, active: false },
    { label: "Crypto", icon: <CryptoGlyph />, active: false },
  ];
  return (
    <div
      className="fixed inset-x-0 bottom-0 px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
    >
      <div className="flex h-[72px] items-center justify-around rounded-full border border-white/[0.06] bg-[rgba(27,30,35,0.85)] backdrop-blur-xl">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex flex-col items-center gap-1"
            style={{ color: it.active ? "#6fbe5c" : "#8c99a6" }}
          >
            <span className="h-[18px] w-[18px]">{it.icon}</span>
            <span className="text-[10px] font-medium leading-none">{it.label}</span>
            {it.active && (
              <span className="h-1 w-1 rounded-full bg-[#6fbe5c]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Inline SVG icons — clean, no third-party dependency
// ────────────────────────────────────────────────────────────────────────────

function QRIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="2" y="2" width="6" height="6" rx="1" />
      <rect x="12" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="12" width="6" height="6" rx="1" />
      <path d="M12 12h2v2h-2zM16 12h2v2h-2zM12 16h2v2h-2zM16 16h2v2h-2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M7 4l6 6-6 6" />
    </svg>
  );
}

function ArrowUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 10V2M3 5l3-3 3 3" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 7h15a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7z" />
      <path d="M3 7V6a2 2 0 0 1 2-2h11" />
      <circle cx="17" cy="13" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function HomeGlyph() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8l6-5 6 5v6a1 1 0 0 1-1 1h-3v-4H7v4H4a1 1 0 0 1-1-1V8z" />
    </svg>
  );
}
function CardsGlyph() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="14" height="10" rx="2" />
      <path d="M2 8h14" />
    </svg>
  );
}
function SavingsGlyph() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M6 9l2 2 4-4" />
    </svg>
  );
}
function StocksGlyph() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 13l4-4 3 3 6-6M11 6h4v4" />
    </svg>
  );
}
function CryptoGlyph() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 1l8 4.5v7L9 17l-8-4.5v-7L9 1z" />
    </svg>
  );
}
