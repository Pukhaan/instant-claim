import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import BalanceChip from "./balance-chip";
import ChatView from "./chat/chat-view";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-8 md:py-12 flex flex-col min-h-screen">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="flex items-center gap-2 group" aria-label="bunq · Teller">
          <span className="relative h-8 w-8 overflow-hidden rounded-xl ring-1 ring-[var(--border)] group-hover:scale-105 transition-transform">
            <Image src="/bunq-logo.png" alt="bunq" fill sizes="32px" priority />
          </span>
          <span className="text-sm font-medium tracking-tight text-muted">· Teller</span>
        </Link>
        <Suspense fallback={null}>
          <BalanceChip />
        </Suspense>
      </header>

      <ChatView hero />
    </div>
  );
}
