// Shared types for the claim pipeline. Keep these in sync with the API route
// contract — the frontend reads the same shape off /api/claim.

export type ClaimType = "broken_screen" | "flight_delay";

export type Decision = "APPROVED" | "REJECTED" | "ESCALATED";

/** Structured facts pulled from the voice-note transcript by Claude. */
export interface ClaimFacts {
  incidentType: ClaimType | "unknown";
  /** ISO date string if mentioned, else null. */
  incidentDate: string | null;
  location: string | null;
  /** Amount the user is claiming, in EUR. */
  claimedAmount: number | null;
  /** For flight_delay: hours delayed. */
  delayHours?: number | null;
  rawTranscript: string;
}

/** Output of Claude Vision on the photo. */
export interface DamageAnalysis {
  matchesClaim: boolean;
  /** Short human-readable description — shown in the UI. */
  summary: string;
  /** 0..1 confidence that the photo supports the claim. */
  confidence: number;
  /** Free-form tags: ["cracked_glass", "display_lines"] etc. */
  tags: string[];
}

export interface PayoutReceipt {
  paymentId: string;
  amount: number;
  currency: "EUR";
  arrivedAt: string; // ISO
}

export interface ClaimResult {
  decision: Decision;
  reason: string;
  amount: number | null;
  facts: ClaimFacts;
  analysis: DamageAnalysis;
  payout: PayoutReceipt | null;
}
