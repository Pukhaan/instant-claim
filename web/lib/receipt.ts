export type ReceiptItem = { name: string; price_eur: number };

export type ExtractedReceipt = {
  merchant: string;
  total_eur: number;
  currency: string;
  date: string;
  category: string;
  items: ReceiptItem[];
  confidence: number;
  note: string;
};

export type ReceiptMatch = {
  payment_id: number;
  account_id: number;
  amount: number;
  created: string;
  counterparty: string | null;
  description: string;
};

export type ProcessReceipt = {
  extracted: ExtractedReceipt;
  match: ReceiptMatch | { error: string } | null;
};

export async function uploadReceipt(file: File): Promise<ProcessReceipt> {
  const form = new FormData();
  form.append("image", file);
  const r = await fetch("/api/receipt", { method: "POST", body: form });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`${r.status}: ${detail.slice(0, 200)}`);
  }
  return (await r.json()) as ProcessReceipt;
}

export async function confirmReceipt(
  paymentId: number,
  extracted: ExtractedReceipt,
): Promise<void> {
  const r = await fetch("/api/receipt/confirm", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payment_id: paymentId, extracted }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`${r.status}: ${detail.slice(0, 200)}`);
  }
}
