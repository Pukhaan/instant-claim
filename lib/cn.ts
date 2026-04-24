// Tiny classNames helper — joins truthy strings with a space.
// Avoids pulling in clsx/twMerge for a 5-line need.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
