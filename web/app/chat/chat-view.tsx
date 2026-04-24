"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { streamChat, resetChat, type ChatEvent } from "@/lib/chat";
import { createRecorder, transcribeBlob, type RecorderHandle } from "@/lib/voice";
import { uploadReceipt } from "@/lib/receipt";
import { submitClaim } from "@/lib/claim";
import { cycleSubmitSteps } from "../claim/decision";
import AssistantMessage from "./assistant-message";
import ReceiptMessage, { type ReceiptMessageState } from "./receipt-message";
import ClaimMessage, { type ClaimPhase } from "./claim-message";
import AudioBubble from "./audio-bubble";

const CLAIM_VOICE_MAX_S = 20;

type Message =
  | { id: string; role: "user"; kind: "text"; text: string }
  | { id: string; role: "user"; kind: "image"; previewUrl: string; caption: string }
  | {
      id: string;
      role: "user";
      kind: "audio";
      blob: Blob;
      duration: number;
      caption: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "text";
      text: string;
      toolCalls: ToolCall[];
      pending: boolean;
    }
  | { id: string; role: "assistant"; kind: "receipt"; state: ReceiptMessageState }
  | { id: string; role: "assistant"; kind: "claim"; phase: ClaimPhase };

type ToolCall = {
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
};

type VoiceState = "idle" | "recording" | "transcribing" | "error";

type ClaimFlow = {
  active: boolean;
  photo: { file: File; preview: string } | null;
  audio: { blob: Blob; duration: number } | null;
  transcript: string | null;
  recordingStream: MediaStream | null;
};

const STARTERS = [
  "What's my balance and what did I spend on recently?",
  "Top me up €500 from Sugar Daddy",
  "I just got a €500 bonus — help me split it into savings, stocks, and fun money",
  "Create a sub-account called Emergency Savings",
];

/** Words that flag the user is opening a claim, not a balance question. */
const CLAIM_TRIGGERS = [
  "claim",
  "broke",
  "broken",
  "cracked",
  "smashed",
  "shattered",
  "stolen",
  "theft",
  "robbed",
  "delayed",
  "delay",
  "cancelled",
  "canceled",
  "missed flight",
  "lost luggage",
  "lost my",
  "damaged",
  "damage",
  "insurance",
  "refund",
  "warranty",
];

const CLAIM_RE = new RegExp(
  String.raw`\b(?:${CLAIM_TRIGGERS.map((w) => w.replace(/\s+/g, "\\s+")).join("|")})\b`,
  "i",
);

function detectsClaim(text: string): boolean {
  return CLAIM_RE.test(text);
}

/** A "bare" claim opener — nothing useful to extract yet. We still need to
 *  ask for a description. e.g. "I have a claim" / "claim" / "file a claim". */
function isBareClaimOpener(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length > 30) return false;
  return /^(?:i\s+(?:have|want|need)|file|start|open|do|do you|can you|how do i|how to)?\s*(?:a\s+|to\s+)?(?:make\s+|file\s+|do\s+|start\s+)?(?:an?\s+)?claim\b[\s.!?]*$/i.test(
    t,
  );
}

export default function ChatView({ hero = false }: { hero?: boolean }) {
  const sessionId = useMemo(() => {
    if (typeof window === "undefined") return "loading";
    let id = sessionStorage.getItem("teller-session");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("teller-session", id);
    }
    return id;
  }, []);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [voice, setVoice] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [claim, setClaim] = useState<ClaimFlow>({
    active: false,
    photo: null,
    audio: null,
    transcript: null,
    recordingStream: null,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const claimFileInputRef = useRef<HTMLInputElement>(null);
  const claimRecorderRef = useRef<RecorderHandle | null>(null);
  const claimTimerRef = useRef<number | null>(null);
  const claimStartRef = useRef<number>(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // ---------------- text chat ----------------

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Auto-detect claim intent. The user types or speaks naturally — no
    // dedicated "I have a claim" button needed.
    if (!claim.active && detectsClaim(trimmed)) {
      setInput("");
      if (isBareClaimOpener(trimmed)) {
        startClaimWithIntro(trimmed);
      } else {
        startClaimWithDescription(trimmed);
      }
      return;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      kind: "text",
      text: trimmed,
    };
    const asst: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "text",
      text: "",
      toolCalls: [],
      pending: true,
    };
    setMessages((m) => [...m, userMsg, asst]);
    setInput("");
    setIsStreaming(true);

    try {
      for await (const evt of streamChat(sessionId, trimmed)) {
        setMessages((m) => applyEvent(m, asst.id, evt));
      }
    } finally {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === asst.id && msg.role === "assistant" && msg.kind === "text"
            ? { ...msg, pending: false }
            : msg,
        ),
      );
      setIsStreaming(false);
    }
  }

  // ---------------- receipt scan (composer camera) ----------------

  async function pickReceipt(file: File) {
    const previewUrl = URL.createObjectURL(file);
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      kind: "image",
      previewUrl,
      caption: "Receipt",
    };
    const asst: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "receipt",
      state: { phase: "reading" },
    };
    setMessages((m) => [...m, userMsg, asst]);

    try {
      const result = await uploadReceipt(file);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === asst.id && msg.role === "assistant" && msg.kind === "receipt"
            ? { ...msg, state: { phase: "ready", result } }
            : msg,
        ),
      );
    } catch (err) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === asst.id && msg.role === "assistant" && msg.kind === "receipt"
            ? {
                ...msg,
                state: {
                  phase: "error",
                  error: err instanceof Error ? err.message : String(err),
                },
              }
            : msg,
        ),
      );
    }
  }

  // ---------------- composer mic (voice → text → /chat) ----------------

  async function toggleMic() {
    setVoiceError(null);
    if (voice === "recording") {
      try {
        const blob = await recorderRef.current!.stop();
        setVoice("transcribing");
        const { text } = await transcribeBlob(blob);
        setVoice("idle");
        if (text.trim()) {
          send(text.trim());
        } else {
          setVoiceError("Didn't catch that — try again.");
        }
      } catch (err) {
        setVoice("error");
        setVoiceError(err instanceof Error ? err.message : String(err));
      }
      return;
    }
    if (voice === "transcribing") return;

    try {
      recorderRef.current = createRecorder();
      await recorderRef.current.start();
      setVoice("recording");
    } catch (err) {
      setVoice("error");
      setVoiceError(
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? "Mic permission denied"
            : err.message
          : String(err),
      );
    }
  }

  // ---------------- claim flow (in-chat orchestrator) ----------------
  // New sequence:
  //   I have a claim → voice ("what's going on?") → audio bubble + transcript
  //   → photo prompt → image bubble → submit → decision card.

  const CLAIM_COVERAGE = "default" as const;

  /** "I have a claim" — bare opener, we still need a description. Opens with
   *  the voice card. */
  function startClaimWithIntro(userText: string) {
    setClaim({
      active: true,
      photo: null,
      audio: null,
      transcript: null,
      recordingStream: null,
    });
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "user",
        kind: "text",
        text: userText,
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        kind: "claim",
        phase: { kind: "voice" },
      },
    ]);
  }

  /** User typed (or spoke) something descriptive enough to use as the claim
   *  transcript directly — skip voice and go straight to the photo step. */
  function startClaimWithDescription(userText: string) {
    setClaim({
      active: true,
      photo: null,
      audio: null,
      transcript: userText,
      recordingStream: null,
    });
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "user",
        kind: "text",
        text: userText,
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        kind: "claim",
        phase: { kind: "photo" },
      },
    ]);
  }

  function startClaim() {
    startClaimWithIntro("I have a claim");
  }

  function openClaimCamera() {
    claimFileInputRef.current?.click();
  }

  async function startClaimVoice() {
    try {
      const recorder = createRecorder();
      claimRecorderRef.current = recorder;
      await recorder.start();
      const stream = recorder.getStream();
      claimStartRef.current = Date.now();
      setClaim((s) => ({ ...s, recordingStream: stream }));
      setMessages((m) =>
        mutateLastClaim(m, () => ({ kind: "voiceRecording", elapsed: 0 })),
      );
      claimTimerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - claimStartRef.current) / 1000;
        if (elapsed >= CLAIM_VOICE_MAX_S) {
          stopClaimVoice();
        } else {
          setMessages((m) =>
            mutateLastClaim(m, (curr) =>
              curr.kind === "voiceRecording" ? { ...curr, elapsed } : curr,
            ),
          );
        }
      }, 100) as unknown as number;
    } catch (err) {
      setMessages((m) =>
        mutateLastClaim(m, () => ({
          kind: "error",
          error: err instanceof Error ? err.message : "Mic permission denied",
        })),
      );
      setClaim((s) => ({ ...s, recordingStream: null }));
    }
  }

  async function stopClaimVoice() {
    if (claimTimerRef.current) {
      window.clearInterval(claimTimerRef.current);
      claimTimerRef.current = null;
    }
    let blob: Blob;
    let duration: number;
    try {
      blob = await claimRecorderRef.current!.stop();
      duration = (Date.now() - claimStartRef.current) / 1000;
    } catch (err) {
      setMessages((m) =>
        mutateLastClaim(m, () => ({
          kind: "error",
          error: err instanceof Error ? err.message : String(err),
        })),
      );
      setClaim((s) => ({ ...s, recordingStream: null }));
      return;
    }

    setClaim((s) => ({ ...s, audio: { blob, duration }, recordingStream: null }));

    // Push the user audio bubble first, then a fresh assistant claim message
    // in `transcribing` state so we have a stable id to flip to `review`.
    const transcribingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "claim",
      phase: { kind: "transcribing" },
    };
    setMessages((m) => [
      // Drop the now-stale `voiceRecording` claim message.
      ...m.filter(
        (msg) =>
          !(
            msg.role === "assistant" &&
            msg.kind === "claim" &&
            (msg.phase.kind === "voiceRecording" || msg.phase.kind === "voice")
          ),
      ),
      {
        id: crypto.randomUUID(),
        role: "user",
        kind: "audio",
        blob,
        duration,
        caption: "Voice note",
      },
      transcribingMsg,
    ]);

    try {
      const { text } = await transcribeBlob(blob);
      const transcript = text.trim();
      setClaim((s) => ({ ...s, transcript: transcript || null }));
      if (!transcript) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === transcribingMsg.id && msg.kind === "claim"
              ? {
                  ...msg,
                  phase: {
                    kind: "error",
                    error: "Didn't catch that — re-record?",
                  },
                }
              : msg,
          ),
        );
        return;
      }
      setMessages((m) =>
        m.map((msg) =>
          msg.id === transcribingMsg.id && msg.kind === "claim"
            ? { ...msg, phase: { kind: "review", transcript, duration } }
            : msg,
        ),
      );
    } catch (err) {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === transcribingMsg.id && msg.kind === "claim"
            ? {
                ...msg,
                phase: {
                  kind: "error",
                  error: err instanceof Error ? err.message : String(err),
                },
              }
            : msg,
        ),
      );
    }
  }

  function confirmClaimTranscript() {
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "user",
        kind: "text",
        text: "Sounds right",
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        kind: "claim",
        phase: { kind: "photo" },
      },
    ]);
  }

  function rerecordClaimVoice() {
    setClaim((s) => ({
      ...s,
      audio: null,
      transcript: null,
      recordingStream: null,
    }));
    setMessages((m) => [
      ...m,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        kind: "claim",
        phase: { kind: "voice" },
      },
    ]);
  }

  function cancelClaimVoice() {
    if (claimTimerRef.current) {
      window.clearInterval(claimTimerRef.current);
      claimTimerRef.current = null;
    }
    claimRecorderRef.current?.cancel();
    setClaim((s) => ({ ...s, recordingStream: null }));
    setMessages((m) => mutateLastClaim(m, () => ({ kind: "voice" })));
  }

  function pickClaimPhoto(file: File) {
    const transcript = claim.transcript;
    if (!transcript) return;
    const preview = URL.createObjectURL(file);
    setClaim((s) => ({ ...s, photo: { file, preview } }));

    const userImage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      kind: "image",
      previewUrl: preview,
      caption: "Damage photo",
    };
    const processingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "claim",
      phase: { kind: "processing", step: "reading_photo" },
    };
    setMessages((m) => [...m, userImage, processingMsg]);

    const ticker = cycleSubmitSteps((step) =>
      setMessages((m) =>
        m.map((msg) =>
          msg.id === processingMsg.id &&
          msg.kind === "claim" &&
          msg.phase.kind === "processing"
            ? { ...msg, phase: { ...msg.phase, step } }
            : msg,
        ),
      ),
    );

    // Send the pre-transcribed text rather than the audio — backend skips
    // its own Transcribe pass and the analysis lands ~5–8 s faster.
    submitClaim({ image: file, transcript, coverage: CLAIM_COVERAGE })
      .then((result) => {
        ticker.cancel();
        setMessages((m) =>
          m.map((msg) =>
            msg.id === processingMsg.id && msg.kind === "claim"
              ? { ...msg, phase: { kind: "decided", result } }
              : msg,
          ),
        );
        setClaim({
          active: false,
          photo: null,
          audio: null,
          transcript: null,
          recordingStream: null,
        });
      })
      .catch((err) => {
        ticker.cancel();
        setMessages((m) =>
          m.map((msg) =>
            msg.id === processingMsg.id && msg.kind === "claim"
              ? {
                  ...msg,
                  phase: {
                    kind: "error",
                    error: err instanceof Error ? err.message : String(err),
                  },
                }
              : msg,
          ),
        );
        setClaim({
          active: false,
          photo: null,
          audio: null,
          transcript: null,
          recordingStream: null,
        });
      });
  }

  // ---------------- misc ----------------

  async function reset() {
    await resetChat(sessionId);
    setMessages([]);
    setClaim({
      active: false,
      photo: null,
      audio: null,
      transcript: null,
      recordingStream: null,
    });
  }

  const hasMessages = messages.length > 0;
  const composerLocked = isStreaming || voice !== "idle" || claim.active;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto -mx-6 px-6 space-y-5 pb-6">
        {!hasMessages ? (
          <Starters hero={hero} onPick={send} />
        ) : (
          messages.map((msg) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              recordingStream={claim.recordingStream}
              onPickPhoto={openClaimCamera}
              onStartVoice={startClaimVoice}
              onStopVoice={stopClaimVoice}
              onCancelVoice={cancelClaimVoice}
              onConfirmTranscript={confirmClaimTranscript}
              onRerecord={rerecordClaimVoice}
              onNewClaim={startClaim}
            />
          ))
        )}
      </div>

      <input
        ref={claimFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/*"
        capture="environment"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickClaimPhoto(f);
          if (claimFileInputRef.current) claimFileInputRef.current.value = "";
        }}
        className="sr-only"
      />

      <form
        className="sticky bottom-4 flex items-end gap-2 bg-[var(--card)] rounded-3xl border border-[var(--border)] p-3 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/*"
          capture="environment"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickReceipt(f);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          className="sr-only"
        />
        <CameraButton
          onClick={() => fileInputRef.current?.click()}
          disabled={composerLocked}
        />
        <MicButton state={voice} error={voiceError} onToggle={toggleMic} disabled={claim.active} />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={
            claim.active
              ? "Finish your claim above…"
              : voice === "recording"
                ? "Listening…"
                : voice === "transcribing"
                  ? "Transcribing…"
                  : "Ask Teller anything about your money…"
          }
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted px-2 py-1.5 leading-relaxed max-h-40"
          disabled={composerLocked}
        />
        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1.5"
              aria-label="Clear conversation"
            >
              clear
            </button>
          )}
          <button
            type="submit"
            disabled={composerLocked || !input.trim()}
            className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-[var(--accent-contrast)] transition-colors hover:bg-accent-hover disabled:opacity-30"
          >
            {isStreaming ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Starters({
  hero,
  onPick,
}: {
  hero: boolean;
  onPick: (s: string) => void;
}) {
  return (
    <div className={hero ? "pt-6 md:pt-10" : "py-12 md:py-16"}>
      {hero ? (
        <div className="mb-8 flex items-center gap-4">
          <span
            className="relative h-16 w-16 shrink-0 rounded-full overflow-hidden ring-1 ring-[var(--border)]"
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/AI_Logo.png" alt="" className="h-full w-full object-cover" />
          </span>
          <div>
            <h1 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
              Hi, I&apos;m Teller.
            </h1>
            <p className="text-muted text-sm md:text-base mt-1 leading-relaxed">
              Your bunq co-pilot. Talk to me, type, snap a receipt, or just tell me something
              broke — I&apos;ll handle the rest.
            </p>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight mb-3 leading-tight">
            What do you want to do with your money?
          </h2>
          <p className="text-muted text-pretty mb-8 leading-relaxed max-w-xl">
            Teller can list accounts, read transactions, move money between your sub-accounts, and
            more. Try one of these to start.
          </p>
        </>
      )}
      <ul className="space-y-2">
        {STARTERS.map((s) => (
          <li key={s}>
            <button
              onClick={() => onPick(s)}
              className="w-full text-left text-sm px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-subtle)] transition-colors"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageRow({
  msg,
  recordingStream,
  onPickPhoto,
  onStartVoice,
  onStopVoice,
  onCancelVoice,
  onConfirmTranscript,
  onRerecord,
  onNewClaim,
}: {
  msg: Message;
  recordingStream: MediaStream | null;
  onPickPhoto: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onCancelVoice: () => void;
  onConfirmTranscript: () => void;
  onRerecord: () => void;
  onNewClaim: () => void;
}) {
  if (msg.role === "user" && msg.kind === "image") {
    return (
      <div className="flex justify-end">
        <figure className="max-w-[60%] rounded-2xl rounded-br-sm border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={msg.previewUrl} alt={msg.caption} className="block w-full max-h-72 object-cover" />
          <figcaption className="text-xs text-muted px-3 py-1.5 border-t border-[var(--border)]">
            {msg.caption}
          </figcaption>
        </figure>
      </div>
    );
  }
  if (msg.role === "user" && msg.kind === "audio") {
    return <AudioBubble blob={msg.blob} duration={msg.duration} caption={msg.caption} />;
  }
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent text-[var(--accent-contrast)] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.kind === "receipt") {
    return <ReceiptMessage state={msg.state} />;
  }
  if (msg.kind === "claim") {
    return (
      <ClaimMessage
        phase={msg.phase}
        recordingStream={recordingStream}
        onPickPhoto={onPickPhoto}
        onStartVoice={onStartVoice}
        onStopVoice={onStopVoice}
        onCancelVoice={onCancelVoice}
        onConfirmTranscript={onConfirmTranscript}
        onRerecord={onRerecord}
        onNewClaim={onNewClaim}
        voiceMaxSeconds={CLAIM_VOICE_MAX_S}
      />
    );
  }
  return (
    <div className="space-y-2">
      {msg.toolCalls.map((tc, i) => (
        <ToolCallRow key={i} call={tc} />
      ))}
      <AssistantMessage text={msg.text} pending={msg.pending} />
    </div>
  );
}

function ToolCallRow({ call }: { call: ToolCall }) {
  const label = humanTool(call.name);
  const status = call.error ? "error" : call.output !== undefined ? "done" : "running";
  return (
    <details className="group rounded-xl border border-[var(--border)] bg-[var(--card)] ml-11">
      <summary className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none hover:text-foreground transition-colors list-none px-3 py-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status === "running"
              ? "bg-[var(--tint-8)] animate-pulse"
              : status === "error"
                ? "bg-[var(--danger)]"
                : "bg-accent"
          }`}
          aria-hidden
        />
        <span className="tabular-nums text-foreground">{label}</span>
        {summarize(call) && <span className="text-muted truncate">· {summarize(call)}</span>}
      </summary>
      <pre className="text-[11px] leading-relaxed text-muted font-mono bg-[var(--input)] rounded-b-xl p-3 overflow-x-auto">
        {JSON.stringify({ input: call.input, output: call.output, error: call.error }, null, 2)}
      </pre>
    </details>
  );
}

function CameraButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Scan a receipt"
      aria-label="Scan a receipt"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-foreground hover:border-[var(--border-strong)] hover:bg-[var(--input)] transition-colors disabled:opacity-40"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      <span className="sr-only">Scan a receipt</span>
    </button>
  );
}

function MicButton({
  state,
  error,
  onToggle,
  disabled,
}: {
  state: VoiceState;
  error: string | null;
  onToggle: () => void;
  disabled: boolean;
}) {
  const active = state === "recording";
  const busy = state === "transcribing";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy || disabled}
      title={
        state === "recording"
          ? "Stop recording"
          : state === "transcribing"
            ? "Transcribing…"
            : error ?? "Hold to speak"
      }
      aria-label={active ? "Stop recording" : "Start voice input"}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40 ${
        active
          ? "border-accent bg-accent text-[var(--accent-contrast)]"
          : busy
            ? "border-[var(--border)] bg-[var(--input)] text-muted"
            : "border-[var(--border)] text-foreground hover:border-[var(--border-strong)] hover:bg-[var(--input)]"
      }`}
    >
      {busy ? <Spinner /> : <MicIcon active={active} />}
      <span className="sr-only">Voice input</span>
    </button>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={active ? "animate-pulse" : undefined}
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function humanTool(name: string): string {
  return (
    {
      whoami: "reading user profile",
      list_accounts: "reading accounts",
      list_transactions: "reading transactions",
      create_sub_account: "creating sub-account",
      move_money: "moving money",
      request_sandbox_money: "requesting test money",
    }[name] ?? name
  );
}

function summarize(call: ToolCall): string {
  if (call.error) return call.error.slice(0, 80);
  if (call.name === "move_money") {
    const { amount_eur, description } = call.input as {
      amount_eur?: number;
      description?: string;
    };
    if (amount_eur) return `€${amount_eur} · ${description ?? ""}`;
  }
  if (call.name === "create_sub_account") {
    const { name } = call.input as { name?: string };
    return name ?? "";
  }
  if (call.name === "list_transactions") {
    const { account_id } = call.input as { account_id?: number };
    return account_id ? `account ${account_id}` : "";
  }
  return "";
}

/** Find the trailing `{kind:"claim"}` assistant message and apply a phase
 *  transformer to it. No-op if no such message exists. */
function mutateLastClaim(
  messages: Message[],
  next: (curr: ClaimPhase) => ClaimPhase,
): Message[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && msg.kind === "claim") {
      const updated = { ...msg, phase: next(msg.phase) };
      return [...messages.slice(0, i), updated, ...messages.slice(i + 1)];
    }
  }
  return messages;
}

function applyEvent(messages: Message[], asstId: string, evt: ChatEvent): Message[] {
  return messages.map((msg) => {
    if (msg.id !== asstId || msg.role !== "assistant" || msg.kind !== "text") return msg;
    switch (evt.type) {
      case "text_delta":
        return { ...msg, text: msg.text + evt.text };
      case "tool_use":
        return {
          ...msg,
          toolCalls: [...msg.toolCalls, { name: evt.name, input: evt.input }],
        };
      case "tool_result":
        return {
          ...msg,
          toolCalls: msg.toolCalls.map((tc, i, arr) =>
            i === arr.length - 1 && tc.name === evt.name && tc.output === undefined
              ? { ...tc, output: evt.output }
              : tc,
          ),
        };
      case "tool_error":
        return {
          ...msg,
          toolCalls: msg.toolCalls.map((tc, i, arr) =>
            i === arr.length - 1 && tc.name === evt.name && tc.output === undefined
              ? { ...tc, error: evt.error }
              : tc,
          ),
        };
      case "done":
        return { ...msg, pending: false };
      case "error":
        return { ...msg, text: msg.text + `\n\n_[error: ${evt.error}]_`, pending: false };
      default:
        return msg;
    }
  });
}
