import { Suspense } from "react";
import Dashboard from "../dashboard";
import TopNav from "../top-nav";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 md:py-14">
      <TopNav current="dashboard" />

      <section className="mb-12">
        <h1 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight leading-[1.05]">
          Your money, at a glance.
        </h1>
        <p className="text-pretty mt-3 text-muted max-w-xl leading-relaxed">
          The snapshot. Balance, recent transactions, and which AI services Teller is wired into
          right now.
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
