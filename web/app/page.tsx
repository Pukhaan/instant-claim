import { Suspense } from "react";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 md:py-20">
      <header className="flex items-baseline justify-between mb-12">
        <div className="flex items-baseline gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight">Teller</h1>
          <span className="text-muted text-sm">
            your bunq co-pilot
          </span>
        </div>
        <span className="text-xs text-muted tabular-nums">sandbox · v0.1</span>
      </header>

      <section className="mb-10">
        <h2 className="text-balance text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
          Banking that hears, sees, and acts.
        </h2>
        <p className="text-pretty mt-4 text-muted max-w-2xl leading-relaxed">
          Teller is an AI that doesn&apos;t just answer your money questions.
          It takes action: invests your bonus on command, categorises receipts from a photo,
          and intervenes before a bad financial choice hits your account.
        </p>
      </section>

      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-40 rounded-xl border border-[var(--border)] bg-[var(--background)] animate-pulse"
        />
      ))}
    </div>
  );
}
