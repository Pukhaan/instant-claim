"use client";

// Verify stage — only shown for device-damage claims. Collects the IMEI (to
// let the policy check + anti-fraud layer match the device to the user's
// bunq purchase record) and a short fraud-declaration checkbox so we can
// show judges we handle the regulatory side.
//
// For other categories the flow skips this stage and goes straight to capture.

type Props = {
  imei: string;
  fraudConfirmed: boolean;
  onImeiChange: (v: string) => void;
  onFraudChange: (v: boolean) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
};

export default function VerifyStage({
  imei,
  fraudConfirmed,
  onImeiChange,
  onFraudChange,
  onContinue,
  onBack,
  onClose,
}: Props) {
  const canContinue = isValidImei(imei) && fraudConfirmed;

  return (
    <div
      className="snap relative flex min-h-[100dvh] flex-col bg-[#05070a] text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)",
      }}
    >
      {/* Nav bar */}
      <div className="relative h-14 px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="absolute left-3 top-2 flex h-10 w-10 items-center justify-center rounded-[20px] bg-white/[0.06] text-white active:opacity-70"
        >
          <ChevronLeft />
        </button>
        <p className="pt-[18px] text-center text-[17px] font-semibold leading-none text-white">
          SnapClaim
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-2 flex h-10 w-10 items-center justify-center rounded-[20px] bg-white/[0.06] text-white active:opacity-70"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Step pills — step 2 active */}
      <div className="flex items-center justify-center gap-2">
        <span className="h-[6px] w-[6px] rounded-[3px] bg-[#08f]" />
        <span className="h-[6px] w-6 rounded-[3px] bg-[#08f]" />
        <span className="h-[6px] w-[6px] rounded-[3px] bg-white/[0.15]" />
        <span className="h-[6px] w-[6px] rounded-[3px] bg-white/[0.15]" />
        <span className="h-[6px] w-[6px] rounded-[3px] bg-white/[0.15]" />
      </div>

      {/* Finn speech bubble */}
      <div className="mt-[26px] flex items-start gap-3 px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#08f]">
          <span
            className="text-[18px] leading-none text-[#05070a]"
            style={{ fontWeight: 900 }}
          >
            F
          </span>
        </div>
        <div
          className="flex-1 overflow-hidden bg-[#12151a] px-4 py-3"
          style={{ borderRadius: "4px 18px 18px 18px" }}
        >
          <p className="text-[11px] font-medium leading-none text-[#08f]">
            Quick checks
          </p>
          <p className="mt-1.5 text-[14px] font-semibold leading-[19px] text-white">
            Device claims need two extra bits so we can match the device to
            your bunq purchase and keep things above board.
          </p>
        </div>
      </div>

      {/* Heading */}
      <div className="mt-7 px-5">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.7px] text-white">
          Verify your device
        </h1>
        <p className="mt-2 text-[13px] leading-tight text-[#8c99a6]">
          Takes 20 seconds. Nothing leaves bunq.
        </p>
      </div>

      {/* IMEI field */}
      <div className="mt-6 px-5">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c99a6]">
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
            className="block w-full rounded-[14px] bg-[#12151a] px-4 py-3.5 text-[16px] font-medium text-white placeholder:text-[#6b7480] focus:outline-none focus:ring-2 focus:ring-[#08f]/60"
            style={{ letterSpacing: "0.02em" }}
          />
          <p className="mt-1.5 text-[11px] text-[#8c99a6]">
            On iPhone: dial{" "}
            <span className="text-white">*#06#</span> to reveal it instantly.
          </p>
        </label>
      </div>

      {/* Fraud declaration */}
      <div className="mt-5 px-5">
        <button
          type="button"
          onClick={() => onFraudChange(!fraudConfirmed)}
          aria-pressed={fraudConfirmed}
          className="flex w-full items-start gap-3 rounded-[14px] bg-[#12151a] px-4 py-3.5 text-left active:opacity-80"
        >
          <span
            aria-hidden
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors"
            style={{
              background: fraudConfirmed ? "#08f" : "transparent",
              borderColor: fraudConfirmed
                ? "#08f"
                : "rgba(255,255,255,0.3)",
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
      </div>

      {/* Spacer so content can't hide under the fixed CTA */}
      <div className="flex-1" />

      {/* Continue CTA */}
      <div
        className="fixed inset-x-0 bottom-0 px-5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="flex h-14 w-full items-center justify-center rounded-[28px] bg-[#08f] text-[16px] font-bold text-[#05070a] transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue · Snap the damage
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

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="#05070a"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7.5L6 10.5 11 4.5" />
    </svg>
  );
}
