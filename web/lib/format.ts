export function formatEUR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  return `${sign}€${abs.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16).replace("T", " ");
}
