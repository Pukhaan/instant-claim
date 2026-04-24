import Image from "next/image";
import Link from "next/link";
import SandboxBadge from "../sandbox-badge";

export default function ClaimHeader() {
  return (
    <header className="flex items-center justify-between mb-8">
      <Link href="/" className="flex items-center gap-2 group" aria-label="Back to chat">
        <span className="relative h-8 w-8 overflow-hidden rounded-xl ring-1 ring-[var(--border)] group-hover:scale-105 transition-transform">
          <Image src="/bunq-logo.png" alt="bunq" fill sizes="32px" />
        </span>
        <span className="text-sm font-medium tracking-tight text-muted">· Claim</span>
      </Link>
      <SandboxBadge />
    </header>
  );
}
