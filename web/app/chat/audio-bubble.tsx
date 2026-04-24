/**
 * User-side voice-note marker, right-aligned to match other user messages.
 * No playback — once the voice note is transcribed, the text itself is the
 * source of truth and we don't want the user second-guessing themselves by
 * re-listening.
 */
export default function AudioBubble({
  duration,
  caption,
}: {
  duration: number;
  caption?: string;
}) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent text-[var(--accent-contrast)] px-4 py-2.5 flex items-center gap-2.5">
        <WaveIcon className="h-4 w-4 opacity-90" />
        <span className="text-xs tabular-nums opacity-95">
          {duration.toFixed(1)}s · {caption ?? "voice note"}
        </span>
      </div>
    </div>
  );
}

function WaveIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 12v0" />
      <path d="M8 8v8" />
      <path d="M12 5v14" />
      <path d="M16 8v8" />
      <path d="M20 12v0" />
    </svg>
  );
}
