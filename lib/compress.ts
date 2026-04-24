// Client-side image compression — runs in the browser before upload.
//
// iPhone shots are 3-5 MB HEIC/JPEG. Whisper + Claude Vision are billed by
// payload size *and* are noticeably slower on big images. Resizing to a
// 1600px long edge + JPEG q0.85 typically drops to 200-500 KB with no
// perceptible quality loss for damage detection.

const TARGET_LONG_EDGE = 1600;
const QUALITY = 0.85;

export async function compressImage(file: File): Promise<File> {
  // Skip compression for already-small files or unknown types we can't decode.
  if (!file.type.startsWith("image/")) return file;
  if (file.size < 500_000) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  const scale = longest > TARGET_LONG_EDGE ? TARGET_LONG_EDGE / longest : 1;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) return file;

  // If compression made it bigger (rare, but possible for tiny images), keep
  // the original.
  if (blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
