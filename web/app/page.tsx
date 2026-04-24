import { Suspense } from "react";
import Dashboard from "./dashboard";
import TopNav from "./top-nav";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 md:py-14">
      <TopNav current="dashboard" />

      <section className="mb-12 md:mb-16">
        <h1 className="text-balance text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
          Banking that hears, sees, and acts.
        </h1>
        <p className="text-pretty mt-4 text-muted max-w-2xl leading-relaxed">
          Teller is an AI that doesn&apos;t just answer your money questions. It takes action:
          invests your bonus on command, categorises receipts from a photo, and intervenes before a
          bad financial choice hits your account.
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
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-40 rounded-2xl border border-[var(--border)] bg-[var(--card)] animate-pulse"
        />
      ))}
    </div>
  );
}
