// Hardcoded coverage rules for the prototype. Keep this file dumb and readable
// — judges will skim it to see the decision logic.

import type {
  ClaimFacts,
  ClaimResult,
  ClaimType,
  DamageAnalysis,
  Decision,
} from "./types";

const BROKEN_SCREEN_MAX_EUR = 300;
const FLIGHT_DELAY_MIN_HOURS = 3;
const FLIGHT_DELAY_PAYOUT_EUR = 250;
const PHOTO_CONFIDENCE_MIN = 0.6;

export function decide(
  claimType: ClaimType,
  facts: ClaimFacts,
  analysis: DamageAnalysis,
): { decision: Decision; reason: string; amount: number | null } {
  if (!analysis.matchesClaim || analysis.confidence < PHOTO_CONFIDENCE_MIN) {
    return {
      decision: "ESCALATED",
      reason: "Photo does not clearly support the claim — routed to a human.",
      amount: null,
    };
  }

  if (claimType === "broken_screen") {
    const amount = facts.claimedAmount;
    if (amount == null) {
      return {
        decision: "ESCALATED",
        reason: "Could not determine claimed amount — needs manual review.",
        amount: null,
      };
    }
    if (amount > BROKEN_SCREEN_MAX_EUR) {
      return {
        decision: "ESCALATED",
        reason: `Claimed €${amount} exceeds the €${BROKEN_SCREEN_MAX_EUR} instant-approval limit.`,
        amount,
      };
    }
    return {
      decision: "APPROVED",
      reason: `Cracked screen confirmed. €${amount} approved under device cover.`,
      amount,
    };
  }

  if (claimType === "flight_delay") {
    const hours = facts.delayHours ?? 0;
    if (hours < FLIGHT_DELAY_MIN_HOURS) {
      return {
        decision: "REJECTED",
        reason: `Flight delay of ${hours}h is below the ${FLIGHT_DELAY_MIN_HOURS}h threshold.`,
        amount: null,
      };
    }
    return {
      decision: "APPROVED",
      reason: `Delay of ${hours}h confirmed. €${FLIGHT_DELAY_PAYOUT_EUR} approved under travel cover.`,
      amount: FLIGHT_DELAY_PAYOUT_EUR,
    };
  }

  return {
    decision: "ESCALATED",
    reason: "Unknown claim type — routed to a human.",
    amount: null,
  };
}

export function buildResult(
  decision: ReturnType<typeof decide>,
  facts: ClaimFacts,
  analysis: DamageAnalysis,
  payout: ClaimResult["payout"] = null,
): ClaimResult {
  return { ...decision, facts, analysis, payout };
}
