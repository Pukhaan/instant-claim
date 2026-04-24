"use client";

// ClaimResult — animated result screen.
//
// Three states driven by ClaimResult.decision:
//   APPROVED  → green check, amount counts up, "€X arrived in your bunq account"
//   REJECTED  → red cross + reason
//   ESCALATED → amber clock + "Our team will review within 24h"
//
// Show the transcript + photo analysis in a collapsible "How we decided"
// panel so judges can see the multimodal reasoning.

import type { ClaimResult as ClaimResultT } from "@/lib/types";

export function ClaimResult({ result: _result }: { result: ClaimResultT }) {
  // TODO(frontend): build the result screen.
  return null;
}
