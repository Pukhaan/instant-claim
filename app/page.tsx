"use client";

// Temporary harness: lets the team (and judges, eventually) actually try the
// PhotoUpload component without the rest of the flow. ClaimForm will replace
// this once the form layer is wired up.

import { useState } from "react";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Pill } from "@/components/ui/Pill";

export default function HomePage() {
  const [photo, setPhoto] = useState<File | null>(null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-ink px-5 pb-10 pt-12 text-text">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold leading-none tracking-tightest">
            SnapClaim
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
            instant-claim · dev harness
          </p>
        </div>
        <Pill tone="lime">photo upload</Pill>
      </header>

      <PhotoUpload value={photo} onChange={setPhoto} />

      {photo && (
        <pre className="mt-4 rounded-xl border border-subtle bg-ink-surface p-3 font-mono text-[10px] leading-relaxed text-text-soft">
          {JSON.stringify(
            {
              name: photo.name,
              type: photo.type,
              sizeKB: Math.round(photo.size / 1024),
            },
            null,
            2,
          )}
        </pre>
      )}
    </main>
  );
}
