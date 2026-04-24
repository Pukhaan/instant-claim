"use client";

// VoiceRecorder — browser mic capture via MediaRecorder.
//
// States: idle → recording → recorded (with playback) → cleared.
// Hard cap: 30 seconds. Render a pulsing waveform while recording so the
// demo feels alive.
//
// Output: a File (webm/opus) passed up to ClaimForm via onChange.

export function VoiceRecorder(_props: {
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  // TODO(frontend): implement.
  return null;
}
