import Link from "next/link";

type Section = "dashboard" | "chat" | "receipt" | "sandbox";

const LINKS: { id: Section; label: string; href: string }[] = [
  { id: "dashboard", label: "Dashboard", href: "/" },
  { id: "chat", label: "Chat", href: "/chat" },
  { id: "receipt", label: "Receipts", href: "/receipt" },
  { id: "sandbox", label: "Sandbox", href: "/sandbox" },
];

export default function TopNav({ current }: { current: Section }) {
  return (
    <header className="flex items-center justify-between mb-10">
      <Link href="/" className="flex items-baseline gap-2.5 group">
        <span
          className="h-2.5 w-2.5 rounded-full bg-accent group-hover:scale-110 transition-transform"
          aria-hidden
        />
        <span className="text-xl font-semibold tracking-tight">Teller</span>
      </Link>

      <nav className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 text-sm">
        {LINKS.map((l) => {
          const active = l.id === current;
          return (
            <Link
              key={l.id}
              href={l.href}
              className={
                active
                  ? "rounded-lg bg-[var(--input)] px-3 py-1.5 font-medium text-foreground"
                  : "rounded-lg px-3 py-1.5 text-muted hover:text-foreground transition-colors"
              }
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      <span className="hidden sm:inline text-xs text-muted tabular-nums">sandbox · v0.1</span>
    </header>
  );
}
