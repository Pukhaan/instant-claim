import { NextRequest, NextResponse } from "next/server";

// POST /api/claim
//
// Multipart form-data payload:
//   - photo:      File  (image of damage / delay notice)
//   - audio:      File  (voice note, webm/m4a/mp3)
//   - claimType:  "broken_screen" | "flight_delay"
//
// Pipeline:
//   1. transcribe(audio) via OpenAI Whisper         → lib/whisper.ts
//   2. analyzeDamage(photo, transcript) via Claude  → lib/claude.ts
//   3. decide(analysis, claimType) via rules engine → lib/rules.ts
//   4. if APPROVED: bunq.payout(amount)             → lib/bunq.ts
//
// Response: { decision, reason, amount, transcript, analysis, payout? }

export async function POST(_req: NextRequest) {
  // TODO(backend): parse multipart form, run pipeline, return ClaimResult.
  return NextResponse.json(
    { error: "not_implemented" },
    { status: 501 },
  );
}
