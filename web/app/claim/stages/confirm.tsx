"use client";

type Fact = { label: string; value: string };

type Props = {
  photoPreviewUrl?: string;
  facts: Fact[];
  onConfirm: () => void;
  onEdit: (label: string) => void;
  onBack: () => void;
};

const DEMO_FACTS: Fact[] = [
  { label: "Date", value: "Tuesday, October 8th" },
  { label: "Time", value: "Around 7:30am" },
  { label: "What", value: "I dropped my iPhone 15 Pro" },
  { label: "Where", value: "Walking to work, downtown" },
  { label: "How", value: "On concrete, hit the screen" },
  { label: "Damage", value: "Cracked screen, lower-right corner" },
];

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

function PencilEditIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M14.5 8.5l1.6-1.6a1.5 1.5 0 0 1 2.1 2.1l-1.6 1.6m-2.1-2.1l-5 5V16h2.5l5-5m-2.5-2.5l2.5 2.5" />
    </svg>
  );
}

export default function ConfirmStage(props: Props) {
  const { photoPreviewUrl, facts, onConfirm, onEdit, onBack } = props;
  const rows = facts && facts.length > 0 ? facts : DEMO_FACTS;

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
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white"
        >
          <ChevronLeftIcon />
        </button>
        <p className="text-[17px] font-semibold text-white">Voice note</p>
        <p className="w-10 text-right text-[13px] text-[#8c99a6]">5/6</p>
      </div>

      {/* Progress bar */}
      <div className="mt-3 px-5">
        <div className="flex gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[3px] flex-1 rounded-full"
              style={{
                background: i < 5 ? "#08f" : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Photo recap */}
      <div className="mx-auto mt-5 max-w-[180px] overflow-hidden rounded-[18px]">
        {photoPreviewUrl ? (
          <img
            src={photoPreviewUrl}
            alt="Damage photo"
            className="block h-[180px] w-[180px] object-cover"
          />
        ) : (
          <div className="h-[180px] w-[180px] bg-[#1c1c1e]" />
        )}
      </div>

      {/* Heading */}
      <h1 className="mt-6 px-5 text-center text-[28px] font-extrabold leading-[1.1] tracking-[-0.5px] text-white">
        Here&apos;s what I heard
      </h1>

      {/* Subtitle */}
      <p className="mt-2 px-5 text-center text-[14px] leading-[20px] text-[#8c99a6]">
        Tap any to fix it. If this is correct, I&apos;ll start checking.
      </p>

      {/* Facts list */}
      <div className="mx-5 mt-7 flex flex-col">
        {rows.map((row, i) => {
          const isLast = i === rows.length - 1;
          return (
            <button
              key={row.label}
              type="button"
              onClick={() => onEdit(row.label)}
              className="flex h-12 items-center justify-between text-left"
              style={{
                borderBottom: isLast
                  ? "none"
                  : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-[#08f]">
                  <PencilEditIcon />
                </span>
                <span className="text-[14px] text-[#8c99a6]">{row.label}</span>
              </div>
              <span className="text-[14px] text-white">{row.value}</span>
            </button>
          );
        })}
      </div>

      <div className="h-[180px]" aria-hidden="true" />

      {/* Bottom CTA */}
      <div
        className="fixed inset-x-0 bottom-0 px-5 pt-3"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <p className="mb-3 text-center text-[12px] text-[#6b7480]">
          I&apos;ll match this to your policy and pay out if covered
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="flex h-14 w-full items-center justify-center rounded-[28px] bg-[#08f] font-bold text-white"
        >
          Looks right, analyze
        </button>
      </div>
    </div>
  );
}
