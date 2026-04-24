// FinnBubble — chat bubble from "Finn", the AI claims assistant. Lime avatar
// with a single "F" + a soft surface bubble. Used to give the user guidance
// inline without it feeling like a banking error.

import { cn } from "@/lib/cn";

export function FinnBubble({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-lime font-sans text-xs font-extrabold text-ink">
        F
      </div>
      <div className="flex-1 rounded-[4px_14px_14px_14px] border border-subtle bg-ink-surface px-3 py-2.5 text-[12.5px] leading-relaxed text-text">
        {children}
      </div>
    </div>
  );
}
