// bunq sandbox API wrapper.
//
// Docs: https://doc.bunq.com
// Flow for a fresh sandbox session:
//   1. POST /v1/installation            → get installation token + server pubkey
//   2. POST /v1/device-server           → register this device (uses API key)
//   3. POST /v1/session-server          → open a user session → session token
//   4. GET  /v1/user/{userId}/monetary-account  → pick an account to pay from
//   5. POST /v1/user/{userId}/monetary-account/{accountId}/payment
//                                        → send instant payout
//
// For the demo we can cache installation + session in memory at module scope
// (single-process Next.js server). Refresh on 401.

import type { PayoutReceipt } from "./types";

const BUNQ_BASE =
  process.env.BUNQ_ENV === "production"
    ? "https://api.bunq.com"
    : "https://public-api.sandbox.bunq.com";

export async function payout(
  _amountEur: number,
  _description: string,
): Promise<PayoutReceipt> {
  // TODO(backend): implement installation → session → payment flow.
  // Keep it simple: one module-level session cache, refresh on 401.
  throw new Error("not_implemented");
}

export { BUNQ_BASE };
