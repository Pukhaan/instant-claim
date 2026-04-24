// Main page — hosts the claim flow (ClaimForm → ClaimResult).
// TODO(frontend): wire up state machine between ClaimForm and ClaimResult.

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">Instant Claim</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Snap a photo. Say what happened. Get paid in seconds.
        </p>
      </header>

      {/* TODO: <ClaimForm /> — photo upload + voice recorder + submit */}
      {/* TODO: <ClaimResult /> — animated approve / reject / escalate screen */}

      <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
        Claim flow goes here.
      </div>
    </main>
  );
}
