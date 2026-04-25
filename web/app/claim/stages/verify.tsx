"use client";

// Verify stage — only shown for device-damage claims. Matches the same
// chrome as every other claim stage (intro / category / review / voice /
// confirm / result): single back-button nav, 6-segment progress bar, 80×80
// rainbow Finn avatar, large heading, subtitle, inset card, fixed bottom CTA.
//
// Functionally: collects the IMEI (so the policy check can match the device
// to the user's bunq purchase record) plus a short fraud-declaration
// checkbox so judges can see we handle the regulatory side. Other categories
// skip this stage and go straight to capture.

type Props = {
  imei: string;
  fraudConfirmed: boolean;
  onImeiChange: (v: string) => void;
  onFraudChange: (v: boolean) => void;
  onContinue: () => void;
  onBack: () => void;
  /** Unused in the new design but kept on the prop contract. */
  onClose?: () => void;
};

export default function VerifyStage({
  imei,
  fraudConfirmed,
  onImeiChange,
  onFraudChange,
  onContinue,
  onBack,
}: Props) {
  const canContinue = isValidImei(imei) && fraudConfirmed;

  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 132px)",
      }}
    >
      {/* Nav row — back · inline title · step caption */}
      <div className="relative flex h-11 items-center px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white active:opacity-70"
        >
          <ChevronLeft />
        </button>
        <span className="ml-2 text-[17px] font-semibold leading-none text-white">
          Verify
        </span>
        <span className="ml-auto pr-2 text-[13px] font-normal leading-none text-[#8c99a6]">
          2/6
        </span>
      </div>

      {/* Progress bar — segments 1-2 filled (verify is a sub-step of category) */}
      <div className="mt-3 flex items-center gap-1 px-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full"
            style={{ background: i < 2 ? "#08f" : "rgba(255,255,255,0.12)" }}
          />
        ))}
      </div>

      {/* Rainbow Finn avatar */}
      <div className="mt-6 px-5">
        <RainbowFinn />
      </div>

      {/* Heading */}
      <h1 className="mt-6 px-5 text-[34px] font-extrabold leading-[1.1] tracking-[-1px] text-white">
        Verify your device
      </h1>

      {/* Subtitle */}
      <p className="mt-3 px-5 text-[14px] leading-[20px] text-[#8c99a6]">
        Two quick bits so we can match the device to your bunq purchase and
        keep things above board. Takes 20 seconds.
      </p>

      {/* IMEI field — inline label + input as a single inset row */}
      <div className="mt-6 mx-5 overflow-hidden rounded-[18px] bg-[#1c1c1e]">
        <label className="block px-4 py-3.5">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c99a6]">
            IMEI number
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="15 digits · Settings → General → About"
            value={imei}
            onChange={(e) =>
              onImeiChange(e.target.value.replace(/\D/g, "").slice(0, 15))
            }
            className="mt-1 block w-full bg-transparent text-[16px] font-medium text-white placeholder:text-[#6b7480] focus:outline-none"
            style={{ letterSpacing: "0.02em" }}
          />
        </label>
      </div>

      <p className="mt-2 px-5 text-[12px] leading-[16px] text-[#6b7480]">
        On iPhone: dial <span className="text-white">*#06#</span> to reveal it
        instantly.
      </p>

      {/* Fraud declaration — same inset-card pattern */}
      <button
        type="button"
        onClick={() => onFraudChange(!fraudConfirmed)}
        aria-pressed={fraudConfirmed}
        className="mt-5 mx-5 flex items-start gap-3 rounded-[18px] bg-[#1c1c1e] px-4 py-3.5 text-left active:opacity-80"
      >
        <span
          aria-hidden
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors"
          style={{
            background: fraudConfirmed ? "#08f" : "transparent",
            borderColor: fraudConfirmed ? "#08f" : "rgba(255,255,255,0.3)",
          }}
        >
          {fraudConfirmed ? <CheckIcon /> : null}
        </span>
        <span className="flex-1 text-[13px] leading-[18px] text-white">
          I confirm everything I tell Finn is accurate. I understand that
          claim fraud can lead to denial, recovery of payouts, and referral
          to authorities under Dutch law.
        </span>
      </button>

      <div className="flex-1" />

      {/* Bottom hint + CTA — fixed */}
      <div
        className="fixed inset-x-0 bottom-0 px-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <p className="mb-2 text-center text-[12px] leading-tight text-[#6b7480]">
          Next take a picture of the damage
        </p>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="flex h-14 w-full items-center justify-center rounded-[28px] bg-[#08f] text-[16px] font-bold text-white transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue to camera
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** IMEI is always 15 digits. Real-world validation would run the Luhn check
 *  too, but for demo purposes any 15-digit string is fine. */
function isValidImei(v: string): boolean {
  return /^\d{15}$/.test(v);
}

// ────────────────────────────────────────────────────────────────────────────
// Rainbow Finn — same character used across the claim flow + bunq home.
// Conic-gradient ring + soft purple-to-black orb + two pill eyes + smile.
// ────────────────────────────────────────────────────────────────────────────

function RainbowFinn() {
  return (
    <div
      className="relative h-20 w-20 rounded-full"
      style={{
        background:
          "conic-gradient(from 0deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00e0ff, #0088ff, #ff2d92, #ff3b30)",
        padding: "2.5px",
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
          className="absolute h-[10px] w-[5px] rounded-full bg-white"
          style={{ left: "27px", top: "30px" }}
        />
        <span
          className="absolute h-[10px] w-[5px] rounded-full bg-white"
          style={{ right: "27px", top: "30px" }}
        />
        <svg
          className="absolute"
          style={{
            top: 44,
            width: 32,
            height: 14,
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

function ChevronLeft() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 4l-6 6 6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="white"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7.5L6 10.5 11 4.5" />
    </svg>
  );
}
