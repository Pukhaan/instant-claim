"use client";

import { useEffect, useState } from "react";

/** User-side audio bubble, right-aligned to match other user messages.
 *  Shows duration + a tiny play button. */
export default function AudioBubble({
  blob,
  duration,
  caption,
}: {
  blob: Blob;
  duration: number;
  caption?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent text-[var(--accent-contrast)] px-4 py-2.5 flex items-center gap-3">
        {url ? (
          <audio src={url} controls className="h-8" />
        ) : (
          <span className="text-xs">loading…</span>
        )}
        <span className="text-xs tabular-nums opacity-90 shrink-0">
          {duration.toFixed(1)}s · {caption ?? "voice note"}
        </span>
      </div>
    </div>
  );
}
