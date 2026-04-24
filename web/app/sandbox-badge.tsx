import Link from "next/link";

/** Small chip that lives in the top-right of the chat landing.
 *  The chat is the app; the sandbox view is the "peek behind the curtain". */
export default function SandboxBadge() {
  return (
    <Link
      href="/sandbox"
      className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-muted hover:border-[var(--accent-border)] hover:bg-[var(--accent-subtle)] hover:text-foreground transition-colors"
      title="Open sandbox view"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      Sandbox
    </Link>
  );
}
