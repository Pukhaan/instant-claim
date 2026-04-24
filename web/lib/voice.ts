export type RecorderState = "idle" | "recording" | "processing" | "error";

export type RecorderHandle = {
  start: () => Promise<void>;
  stop: () => Promise<Blob>;
  cancel: () => void;
  isActive: () => boolean;
  /** The active mic stream while recording. Useful for piping into a
   *  Web Audio AnalyserNode for waveform rendering. Null before start
   *  / after stop. */
  getStream: () => MediaStream | null;
};

/**
 * Thin wrapper around MediaRecorder. Captures a single blob from the default
 * mic and returns a Promise resolving to the audio data on stop().
 */
export function createRecorder(): RecorderHandle {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let stopResolve: ((blob: Blob) => void) | null = null;
  let stopReject: ((err: Error) => void) | null = null;

  function cleanupStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    recorder = null;
  }

  return {
    async start() {
      if (recorder) return;
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m),
      );
      recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const mime = recorder?.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: mime });
        cleanupStream();
        stopResolve?.(blob);
        stopResolve = null;
        stopReject = null;
      };
      recorder.onerror = (e) => {
        cleanupStream();
        stopReject?.(new Error("recorder error"));
      };
      recorder.start();
    },

    async stop() {
      if (!recorder) throw new Error("not recording");
      return new Promise<Blob>((resolve, reject) => {
        stopResolve = resolve;
        stopReject = reject;
        recorder!.stop();
      });
    },

    cancel() {
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      cleanupStream();
      stopResolve = null;
      stopReject = null;
      chunks = [];
    },

    isActive: () => recorder != null && recorder.state === "recording",

    getStream: () => stream,
  };
}

export async function transcribeBlob(blob: Blob): Promise<{ text: string }> {
  const form = new FormData();
  const mime = blob.type || "audio/webm";
  form.append("audio", blob, filenameFor(mime));
  const r = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`${r.status}: ${detail.slice(0, 200)}`);
  }
  return (await r.json()) as { text: string };
}

function filenameFor(mime: string): string {
  if (mime.includes("webm")) return "voice.webm";
  if (mime.includes("ogg")) return "voice.ogg";
  if (mime.includes("mp4")) return "voice.m4a";
  if (mime.includes("wav")) return "voice.wav";
  return "voice.bin";
}
