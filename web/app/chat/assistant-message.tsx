import Image from "next/image";
import { parseCards } from "@/lib/parse-cards";

export default function AssistantMessage({
  text,
  pending,
}: {
  text: string;
  pending: boolean;
}) {
  const cards = parseCards(text);
  const hasStructure = cards.some((c) => c.label !== null);

  return (
    <div className="flex items-start gap-3">
      <Avatar />
      <div className="flex-1 min-w-0 space-y-2 pt-0.5">
        {!text && pending && <ThinkingDots />}
        {hasStructure ? (
          cards.map((c, i) => <Card key={i} card={c} />)
        ) : text ? (
          <PlainBubble text={text} pending={pending} />
        ) : null}
        {hasStructure && pending && (
          <div className="pl-1 pt-1">
            <span className="inline-block animate-pulse text-muted">▍</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar() {
  return (
    <span className="relative h-8 w-8 shrink-0 rounded-full overflow-hidden bg-[var(--card)] ring-1 ring-[var(--border)]">
      <Image src="/AI_Logo.png" alt="Teller" fill sizes="32px" priority />
    </span>
  );
}

function Card({ card }: { card: { label: string | null; body: string } }) {
  if (!card.body && !card.label) return null;
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      {card.label && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent mb-1.5">
          {card.label}
        </p>
      )}
      <Body text={card.body} />
    </section>
  );
}

function PlainBubble({ text, pending }: { text: string; pending: boolean }) {
  return (
    <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
      {text}
      {pending && <span className="inline-block ml-1 animate-pulse text-muted">▍</span>}
    </div>
  );
}

function Body({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.length > 0);
  const isList = lines.length > 1 && lines.every((l) => /^[-*•]\s+/.test(l.trim()));

  if (isList) {
    return (
      <ul className="space-y-1.5 text-sm leading-relaxed">
        {lines.map((line, i) => {
          const content = line.trim().replace(/^[-*•]\s+/, "");
          return (
            <li key={i} className="flex gap-2">
              <span className="text-muted mt-[0.35em]" aria-hidden>
                ·
              </span>
              <span className="tabular-nums">{content}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap tabular-nums">
      {text}
    </p>
  );
}

function ThinkingDots() {
  return (
    <div
      className="inline-flex items-center gap-1 text-muted text-sm pt-2"
      aria-label="Teller is thinking"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint-8)] animate-pulse [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint-8)] animate-pulse [animation-delay:200ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--tint-8)] animate-pulse [animation-delay:400ms]" />
    </div>
  );
}
