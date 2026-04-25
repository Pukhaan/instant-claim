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

      <YourTravel />

      <RecentTransactions />

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
      <div className="flex items-center gap-3">
        {/* Avatar with magenta-pink rim — bunq Elite tier marker */}
        <div
          className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, #ff2d92, #ff7819, #ff2d92, #c41fa6, #ff2d92)",
            padding: "2px",
          }}
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#3a2a35] to-[#1a1015] text-[18px] font-bold text-white">
            V
          </div>
          {/* Tiny "Elite" badge anchored top-right */}
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#ff2d92] text-[10px] font-bold text-white"
          >
            ✦
          </span>
        </div>
        <div className="text-[13px] font-semibold leading-[15px]">
          <p className="text-[#ff2d92]">bunq Elite</p>
          <p className="mt-0.5 text-white">Valeriu</p>
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
// Your Travel — entry to the claim flow, replaces the old SnapClaim card.
// Centered rainbow Finn avatar + headline + Start a Claim link.
// ────────────────────────────────────────────────────────────────────────────

function YourTravel() {
  return (
    <section className="mt-7 px-5">
      <h2 className="px-4 text-[18px] font-bold leading-[1.2] text-[#f5f7fa]">
        Your Travel
      </h2>
      <div className="mt-2 rounded-2xl bg-[#1c1c1e] px-5 py-6 text-center">
        <div className="flex justify-center">
          <RainbowFinn size={80} />
        </div>
        <h3 className="mt-4 text-[18px] font-bold leading-tight tracking-tight text-white">
          Something Happened? No worries!
        </h3>
        <p className="mt-2 text-[13px] leading-[19px] text-[#8c99a6]">
          Finn, your assistant, will walk you through it. Photo, voice
          note, done. Usually settled in under a minute.
        </p>
        <Link
          href="/claim"
          className="mt-3 inline-flex h-9 items-center justify-center text-[16px] font-bold text-[#0096ff] active:opacity-60"
        >
          Start a Claim
        </Link>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Recent Transactions — small list under Your Travel
// ────────────────────────────────────────────────────────────────────────────

function RecentTransactions() {
  return (
    <section className="mt-7 px-5">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-[18px] font-bold leading-[1.2] text-[#f5f7fa]">
          Recent Transactions
        </h2>
        <button
          type="button"
          className="text-[13px] font-semibold text-[#0096ff] active:opacity-60"
        >
          See all
        </button>
      </div>
      <div className="mt-2 rounded-2xl bg-[#1c1c1e] p-2">
        <TxRow
          merchantInitial="N"
          merchantBg="#ffffff"
          merchantColor="#000000"
          name="Notion"
          sub="Online Payment"
          amount="-2,89"
          amountColor="#ff7819"
        />
      </div>
    </section>
  );
}

function TxRow({
  merchantInitial,
  merchantBg,
  merchantColor,
  name,
  sub,
  amount,
  amountColor,
}: {
  merchantInitial: string;
  merchantBg: string;
  merchantColor: string;
  name: string;
  sub: string;
  amount: string;
  amountColor: string;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full text-[18px] font-bold"
          style={{ background: merchantBg, color: merchantColor }}
        >
          {merchantInitial}
        </div>
        <div>
          <p className="text-[16px] font-semibold leading-tight text-white">
            {name}
          </p>
          <p className="mt-0.5 text-[13px] leading-tight text-[#8c99a6]">
            {sub}
          </p>
        </div>
      </div>
      <p
        className="text-[17px] font-bold tracking-tight"
        style={{ color: amountColor }}
      >
        € {amount}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Rainbow Finn — same character used inside the claim flow
// ────────────────────────────────────────────────────────────────────────────

function RainbowFinn({ size = 80 }: { size?: number }) {
  const eyeOffsetTop = size * 0.36;
  const eyeWidth = size * 0.07;
  const eyeHeight = size * 0.13;
  const eyeFromCenter = size * 0.18;
  return (
    <div
      className="relative rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00e0ff, #0088ff, #ff2d92, #ff3b30)",
        padding: 2.5,
      }}
      aria-hidden
    >
      <div
        className="relative flex h-full w-full items-center justify-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, #2a1f3a 0%, #0a0710 100%)",
        }}
      >
        <span
          className="absolute rounded-full bg-white"
          style={{
            width: eyeWidth,
            height: eyeHeight,
            top: eyeOffsetTop,
            left: `calc(50% - ${eyeFromCenter}px - ${eyeWidth / 2}px)`,
          }}
        />
        <span
          className="absolute rounded-full bg-white"
          style={{
            width: eyeWidth,
            height: eyeHeight,
            top: eyeOffsetTop,
            right: `calc(50% - ${eyeFromCenter}px - ${eyeWidth / 2}px)`,
          }}
        />
        <svg
          className="absolute"
          style={{
            top: size * 0.55,
            width: size * 0.4,
            height: size * 0.18,
            left: "50%",
            transform: "translateX(-50%)",
          }}
          viewBox="0 0 32 14"
          fill="none"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
        >
          <path d="M3 3c2.5 5 8 8 13 8s10.5-3 13-8" />
        </svg>
      </div>
    </div>
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
      <div className="flex h-[72px] items-center justify-around rounded-full border border-white/[0.06] bg-[rgba(27,30,35,0.85)] backdrop-blur-md">
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            aria-current={it.active ? "page" : undefined}
            aria-label={it.label}
            className="flex flex-col items-center gap-1 px-3 py-2 active:opacity-60"
            style={{ color: it.active ? "#6fbe5c" : "#8c99a6" }}
          >
            <span className="h-[18px] w-[18px]">{it.icon}</span>
            <span className="text-[10px] font-medium leading-none">{it.label}</span>
            {it.active && (
              <span className="h-1 w-1 rounded-full bg-[#6fbe5c]" />
            )}
          </button>
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
