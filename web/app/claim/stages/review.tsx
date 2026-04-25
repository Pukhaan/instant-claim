"use client";

import FinnAvatar from "../../finn-avatar";

type Props = {
  previewUrl: string;
  onRetake: () => void;
  onAddAnother?: () => void;
  onContinue: () => void;
  onBack: () => void;
};

export default function ReviewStage({
  previewUrl,
  onRetake,
  onAddAnother,
  onContinue,
  onBack,
}: Props) {
  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 132px)",
      }}
    >
      {/* Nav row */}
      <div className="flex h-11 items-center px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,255,255,0.06)] active:opacity-70"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.5 4 6.5 10l6 6" />
          </svg>
        </button>
        <span className="ml-2 text-[17px] font-semibold text-white">
          Review Photo
        </span>
        <span className="ml-auto text-[13px] text-[#8c99a6]">3/6</span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex gap-1 px-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{
              background: i < 3 ? "#0088ff" : "rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>

      {/* Avatar */}
      <div className="mt-6 px-5">
        <FinnAvatar size={80} mood="surprised" />
      </div>

      {/* Heading */}
      <h1 className="mt-6 px-5 text-[34px] font-extrabold leading-[1.1] tracking-[-1px] text-white">
        Good shot?
      </h1>

      {/* Subtitle */}
      <p className="mt-3 px-5 text-[14px] leading-[20px] text-[#8c99a6]">
        I&apos;ll analyze the damage from this photo in a second. If it&apos;s
        blurry or partial, you can retake it again.
      </p>

      {/* Photo frame */}
      <div className="relative mx-5 mt-5 overflow-hidden rounded-[20px] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Captured damage"
          className="block h-auto w-full object-cover"
          style={{ aspectRatio: "4 / 3" }}
        />
        {/* Red dashed annotation */}
        <div
          className="pointer-events-none absolute rounded-[14px] border-2 border-dashed border-[#ff3b30]"
          style={{ inset: "6%" }}
          aria-hidden
        />
        {/* Pill */}
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[#ff3b30] px-3 py-1.5 text-[13px] font-bold text-white"
        >
          cracked screen
        </span>
      </div>

      {/* Two-button row */}
      <div className="mx-5 mt-5 flex gap-3">
        <button
          type="button"
          onClick={onRetake}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border-2 border-[#ff7819] bg-[#66300a] text-[14px] font-bold text-white active:opacity-80"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#ff7819"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 8a5 5 0 1 1 1.5 3.5" />
            <path d="M3 4v4h4" />
          </svg>
          <span>Retake</span>
        </button>
        <button
          type="button"
          onClick={onAddAnother}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border-2 border-[#0088ff] bg-[#003666] text-[14px] font-bold text-white active:opacity-80"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#0088ff"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
          <span>Add another</span>
        </button>
      </div>

      {/* Finn next-up info card */}
      <div className="mx-5 mt-5 rounded-[14px] bg-[#1c1c1e] p-4 text-[13px] leading-[18px] text-[#8c99a6]">
        Next up: a ~20-second voice note. Tell me{" "}
        <strong className="font-bold text-white">when</strong>,{" "}
        <strong className="font-bold text-white">where</strong>, and{" "}
        <strong className="font-bold text-white">how</strong> it happened. Just
        speak natural, no formalities necessary. I will do all the paperwork for
        you ;)
      </div>

      {/* Bottom hint + CTA */}
      <div
        className="fixed inset-x-0 bottom-0 px-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <p className="mb-2 text-center text-[12px] text-[#6b7480]">
          Next: explain me in details what happened
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="h-14 w-full rounded-[28px] bg-[#0088ff] text-[16px] font-bold text-white active:opacity-90"
        >
          Record voice note
        </button>
      </div>
    </div>
  );
}

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
