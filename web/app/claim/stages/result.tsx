"use client";

// Final result stage (6/6) — "Payout Confirmed!" Approved variant matches
// the Figma design: top "Done" / "✕" header, full progress bar, big
// celebrating Finn, hero amount in green, claim ID footer.

import FinnAvatar from "../../finn-avatar";

type Props = {
  amount: number;
  claimId?: string;
  status?: string;
  type?: string;
  action?: string;
  onDone: () => void;
};

export default function ResultStage({ amount, claimId, onDone }: Props) {
  const id =
    claimId ??
    `SC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`;
  const integer = Math.floor(amount);
  const cents = Math.round((amount - integer) * 100)
    .toString()
    .padStart(2, "0");

  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Nav row — "Done" left, ✕ right */}
      <div className="relative flex h-11 items-center px-4">
        <button
          type="button"
          onClick={onDone}
          className="text-[17px] font-semibold leading-none text-[#08f] active:opacity-60"
        >
          Done
        </button>
        <button
          type="button"
          onClick={onDone}
          aria-label="Close"
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white active:opacity-70"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Progress bar — all 6 segments filled */}
      <div className="mt-3 flex items-center gap-1 px-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-1 flex-1 rounded-full bg-[#08f]" />
        ))}
      </div>

      {/* Big celebrating Finn */}
      <div className="mt-6 flex justify-center">
        <FinnAvatar size={200} mood="celebrating" />
      </div>

      {/* Heading */}
      <h1 className="mt-6 px-5 text-center text-[34px] font-extrabold leading-[1.1] tracking-[-1px] text-white">
        Payout Confirmed!
      </h1>

      {/* Subtitle */}
      <p className="mt-3 px-6 text-center text-[14px] leading-[20px] text-[#8c99a6]">
        Finn has reviewed everything and your claim is confirmed. Your payout
        is on its way! Sit back and relax — we&apos;ve got you covered.
      </p>

      {/* Hero amount card */}
      <div className="mt-6 mx-5 rounded-[20px] bg-[#1c1c1e] px-5 py-6">
        <div className="flex justify-center">
          <span className="rounded-full bg-[#0d3d22] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#34c759]">
            Approved
          </span>
        </div>
        <p className="mt-4 text-center font-extrabold leading-none tracking-[-2px] text-[#34c759]">
          <span className="text-[28px]">€&nbsp;</span>
          <span className="text-[64px]">{integer}.</span>
          <span className="text-[36px]">{cents}</span>
        </p>
        <p className="mt-3 text-center text-[12px] leading-[16px] text-[#8c99a6]">
          The funds will be deposited into your account soon.
        </p>

        <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3">
          <span className="text-[12px] font-medium text-[#8c99a6]">
            Claim ID
          </span>
          <span className="text-[13px] font-semibold tabular-nums text-white">
            {id}
          </span>
        </div>
      </div>

      <div className="min-h-6 flex-1" />
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
}
