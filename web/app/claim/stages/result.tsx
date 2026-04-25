"use client";

type Props = {
  amount: number;
  status?: string;
  type?: string;
  action?: string;
  onDone: () => void;
};

function ChevronLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function splitAmount(amount: number): { whole: string; cents: string } {
  const safe = Number.isFinite(amount) ? amount : 0;
  const fixed = safe.toFixed(2);
  const [whole, cents] = fixed.split(".");
  return { whole, cents: cents ?? "00" };
}

export default function ResultStage(props: Props) {
  const {
    amount,
    status = "Approved",
    type = "Device damage",
    action = "Repair scheduled",
    onDone,
  } = props;

  const display = splitAmount(amount ?? 600);

  const metaRows: Array<{ label: string; value: string; valueClass?: string }> = [
    { label: "Status", value: status, valueClass: "text-[#08f]" },
    { label: "Type", value: type },
    { label: "Action", value: action },
  ];

  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Nav */}
      <div className="flex h-11 items-center justify-between px-3">
        <button
          type="button"
          onClick={onDone}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white"
        >
          <ChevronLeftIcon />
        </button>
        <p className="text-[17px] font-semibold text-white">Approved!</p>
        <p className="w-10 text-right text-[13px] text-[#8c99a6]">6/6</p>
      </div>

      {/* Progress bar */}
      <div className="mt-3 px-5">
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[3px] flex-1 rounded-full"
              style={{ background: "#08f" }}
            />
          ))}
        </div>
      </div>

      {/* Hero amount card */}
      <div className="mx-5 mt-6 rounded-[20px] bg-[#1c1c1e] py-8 text-center">
        <p className="text-[13px] text-[#8c99a6]">Total Coverage</p>
        <p className="mt-2 text-[64px] font-extrabold leading-none tracking-[-2px] text-white">
          €{display.whole}.
          <span className="text-[40px] font-bold">{display.cents}</span>
        </p>
        <p className="mt-3 text-[13px] font-semibold text-[#08f]">
          Will be paid in 2-3 business days
        </p>
      </div>

      {/* Meta rows */}
      <div className="mx-5 mt-6 flex flex-col">
        {metaRows.map((row, i) => {
          const isLast = i === metaRows.length - 1;
          return (
            <div
              key={row.label}
              className="flex h-12 items-center justify-between"
              style={{
                borderBottom: isLast
                  ? "none"
                  : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="text-[14px] text-[#8c99a6]">{row.label}</span>
              <span className={`text-[14px] text-white ${row.valueClass ?? ""}`}>
                {row.value}
              </span>
            </div>
          );
        })}
      </div>

      <div className="h-[140px]" aria-hidden="true" />

      {/* Bottom CTA */}
      <div
        className="fixed inset-x-0 bottom-0 px-5 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <button
          type="button"
          onClick={onDone}
          className="flex h-14 w-full items-center justify-center rounded-[28px] bg-[#08f] font-bold text-white"
        >
          Back to my bunq
        </button>
      </div>
    </div>
  );
}
