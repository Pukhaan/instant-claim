export type AssistantCard = {
  label: string | null;
  body: string;
};

/**
 * Parse an assistant message that may contain `## Section` dividers into cards.
 *
 * - Text before any `## Section` becomes an untagged card (label: null).
 * - Each `## Label\nbody...` becomes a labelled card.
 * - Works incrementally — during streaming, a half-written section still parses
 *   (the last card may have no body yet, or a partial label).
 */
export function parseCards(text: string): AssistantCard[] {
  if (!text) return [];
  const parts = text.split(/\n## |^## /g);
  const cards: AssistantCard[] = [];

  const first = parts.shift() ?? "";
  if (first.trim()) cards.push({ label: null, body: first.trim() });

  for (const part of parts) {
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) {
      cards.push({ label: part.trim() || "…", body: "" });
    } else {
      cards.push({
        label: part.slice(0, newlineIdx).trim() || "…",
        body: part.slice(newlineIdx + 1).trim(),
      });
    }
  }
  return cards;
}
