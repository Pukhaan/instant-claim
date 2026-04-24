import Link from "next/link";

type Section = "home" | "dashboard" | "receipt" | "chat";

const LINKS: { id: Section; label: string; href: string }[] = [
  { id: "home", label: "Chat", href: "/" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "receipt", label: "Receipts", href: "/receipt" },
];

export default function TopNav({ current }: { current: Section }) {
  // /chat route still exists as a deep-link alias → highlight the Chat tab.
  const active: Section = current === "chat" ? "home" : current;
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
          const isActive = l.id === active;
          return (
            <Link
              key={l.id}
              href={l.href}
              className={
                isActive
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
