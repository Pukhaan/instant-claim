export type ClaimDecision = {
  decision: "approve" | "reject" | "escalate";
  damage_type: string;
  severity: "low" | "medium" | "high";
  claim_amount_eur: number;
  deductible_eur?: number;
  payout_eur: number;
  matched_payment_id: number | null;
  policy_clause?: string;
  reason: string;
  confidence: number;
};

export type ClaimResponse = {
  decision: ClaimDecision;
  transcript: {
    text: string;
    language: string | null;
    confidence: number | null;
    duration_s: number | null;
  };
  policy: { coverage: string; clause: string };
  payout: { amount_eur?: number; requested_eur?: number; error?: string } | null;
  context: { transactions_considered: number };
};

export type Coverage = "default" | "phone" | "travel";

export async function submitClaim(args: {
  image: File | Blob;
  /** Optional — required if `transcript` is not given. */
  audio?: File | Blob | null;
  /** Pre-transcribed voice note. Skipping the backend Transcribe pass saves
   *  5–8 seconds on the final analysis. */
  transcript?: string;
  coverage?: Coverage;
}): Promise<ClaimResponse> {
  const form = new FormData();
  form.append("image", args.image, "claim.jpg");
  if (args.audio) {
    form.append("audio", args.audio, audioFilename(args.audio.type));
  }
  if (args.transcript && args.transcript.trim()) {
    form.append("transcript", args.transcript.trim());
  }
  form.append("coverage", args.coverage ?? "default");

  const r = await fetch("/api/claim", { method: "POST", body: form });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`${r.status}: ${detail.slice(0, 300)}`);
  }
  return (await r.json()) as ClaimResponse;
}

function audioFilename(mime: string): string {
  if (mime.includes("webm")) return "voice.webm";
  if (mime.includes("ogg")) return "voice.ogg";
  if (mime.includes("mp4")) return "voice.m4a";
  if (mime.includes("wav")) return "voice.wav";
  return "voice.bin";
}
