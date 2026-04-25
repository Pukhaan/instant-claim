"use client";

import type { CSSProperties } from "react";

type Props = {
  onContinue: () => void;
  onBack: () => void;
};

const STEPS: ReadonlyArray<{ title: string; sub: string }> = [
  {
    title: "Snap a photo",
    sub: "Of the damaged item, delay board, or receipt",
  },
  {
    title: "Tell me what happened",
    sub: "A 20-second voice note - when, where, how",
  },
  {
    title: "I do the rest",
    sub: "Check your policy, match the purchase, pay out",
  },
];

function ChevronLeftIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12.5 4L6.5 10L12.5 16"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 5.25V8.5"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="6" cy="3.5" r="0.85" fill="white" />
    </svg>
  );
}

function RainbowFinn() {
  const ringStyle: CSSProperties = {
    background:
      "conic-gradient(from 0deg, #ff2d55, #ff9500, #ffcc00, #34c759, #00c7be, #007aff, #af52de, #ff2d55)",
    padding: "2.5px",
  };

  const innerStyle: CSSProperties = {
    background: "radial-gradient(circle at 50% 35%, #2a1f3a 0%, #0a0710 85%)",
  };

  return (
    <div
      className="relative flex h-20 w-20 items-center justify-center rounded-full"
      style={ringStyle}
      aria-hidden="true"
    >
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={innerStyle}
      >
        {/* Eyes */}
        <div className="absolute left-0 right-0 top-[28%] flex justify-center gap-3">
          <span
            className="block bg-white"
            style={{
              width: "4px",
              height: "8px",
              borderRadius: "2px",
            }}
          />
          <span
            className="block bg-white"
            style={{
              width: "4px",
              height: "8px",
              borderRadius: "2px",
            }}
          />
        </div>

        {/* Smile */}
        <svg
          width="28"
          height="14"
          viewBox="0 0 28 14"
          fill="none"
          className="absolute left-1/2 top-[58%] -translate-x-1/2"
        >
          <path
            d="M2 2C5 9 11 12 14 12C17 12 23 9 26 2"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export default function IntroductionStage({ onContinue, onBack }: Props) {
  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)",
      }}
    >
      {/* Nav row */}
      <div className="flex h-11 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
          >
            <ChevronLeftIcon />
          </button>
          <span className="text-[17px] font-semibold text-white">
            Introduction
          </span>
        </div>
        <span className="text-[13px] font-normal text-[#8c99a6]">1/6</span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex gap-1 px-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{
              backgroundColor:
                i === 0 ? "#08f" : "rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="px-5">
        {/* Avatar */}
        <div className="mt-6">
          <RainbowFinn />
        </div>

        {/* Heading */}
        <h1
          className="mt-6 text-[40px] font-extrabold text-white"
          style={{
            lineHeight: 1.05,
            letterSpacing: "-1px",
          }}
        >
          Hi, I&apos;m Finn.
          <br />
          Let&apos;s sort this out.
        </h1>

        {/* Subtitle */}
        <p
          className="mt-3 text-[14px] text-[#8c99a6]"
          style={{ lineHeight: "20px" }}
        >
          I&apos;ll walk you through{" "}
          <span className="font-bold text-white">three quick steps</span>.
          Should take about a minute, and most claims get paid the moment
          we&apos;re done.
        </p>

        {/* Steps */}
        <ol className="mt-7 flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-3">
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white"
                style={{ backgroundColor: "#ff7819" }}
              >
                {i + 1}
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold text-white">
                  {step.title}
                </span>
                <span
                  className="text-[13px] text-[#8c99a6]"
                  style={{ lineHeight: "1.35" }}
                >
                  {step.sub}
                </span>
              </div>
            </li>
          ))}
        </ol>

        {/* Good to know card */}
        <div
          className="mt-7 rounded-[14px] p-4"
          style={{ backgroundColor: "#1c1c1e" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full"
              style={{ backgroundColor: "#08f" }}
            >
              <InfoIcon />
            </div>
            <span className="text-[15px] font-semibold text-white">
              Good to know
            </span>
          </div>
          <p
            className="mt-2 text-[13px] text-[#8c99a6]"
            style={{ lineHeight: "19px" }}
          >
            Your Easy Device + Travel cover is active. I&apos;ll never ask for
            info you&apos;ve already given me.
          </p>
        </div>
      </div>

      {/* Bottom hint + CTA */}
      <div
        className="fixed inset-x-0 bottom-0 px-5"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
        }}
      >
        <p className="mb-2 text-center text-[12px] text-[#6b7480]">
          You can always edit or cancel later
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="flex h-14 w-full items-center justify-center text-[16px] font-bold text-white"
          style={{
            backgroundColor: "#08f",
            borderRadius: "28px",
          }}
        >
          Pick category
        </button>
      </div>
    </div>
  );
}
