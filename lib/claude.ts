// Claude wrapper — vision + reasoning.
//
// Two calls:
//   1. analyzePhoto(imageBase64, claimType)        → DamageAnalysis
//   2. extractFacts(transcript, claimType)         → ClaimFacts
//
// Model: claude-sonnet-4-6 (latest Sonnet, good multimodal + cheap enough).
// Both calls should return strict JSON (use a JSON schema / tool-use or
// instruct in the prompt + JSON.parse the response).

import Anthropic from "@anthropic-ai/sdk";
import type { ClaimFacts, ClaimType, DamageAnalysis } from "./types";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzePhoto(
  _imageBase64: string,
  _mimeType: string,
  _claimType: ClaimType,
): Promise<DamageAnalysis> {
  // TODO(ai): send image + claimType to Claude, parse JSON response.
  throw new Error("not_implemented");
}

export async function extractFacts(
  _transcript: string,
  _claimType: ClaimType,
): Promise<ClaimFacts> {
  // TODO(ai): structured extraction from transcript.
  throw new Error("not_implemented");
}
