"use client";

// ClaimForm — photo upload + voice recorder + claim-type selector + submit.
//
// Responsibilities:
//   - Let the user pick claim type (broken_screen | flight_delay)
//   - Capture a photo (file input with capture="environment" for mobile camera)
//   - Record a voice note via MediaRecorder (webm/opus)
//   - POST multipart form to /api/claim
//   - Lift the ClaimResult up to the parent so <ClaimResult /> can render it
//
// Keep this component self-contained. Use Framer Motion for small transitions
// (recording pulse, upload shimmer).

export function ClaimForm() {
  // TODO(frontend): build the form.
  return null;
}
