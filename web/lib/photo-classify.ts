export type PhotoKind = "receipt" | "damage" | "other";

export type ClassifyResult = {
  kind: PhotoKind;
  subject: string;
  summary?: string;
  confidence: number;
};

export async function classifyPhoto(file: File | Blob): Promise<ClassifyResult> {
  const form = new FormData();
  form.append("image", file, "photo.jpg");
  const r = await fetch("/api/classify-photo", { method: "POST", body: form });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`${r.status}: ${detail.slice(0, 200)}`);
  }
  return (await r.json()) as ClassifyResult;
}
