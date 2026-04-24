"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { streamChat, resetChat, type ChatEvent } from "@/lib/chat";
import { createRecorder, transcribeBlob, type RecorderHandle } from "@/lib/voice";
import { uploadReceipt } from "@/lib/receipt";
import AssistantMessage from "./assistant-message";
import ReceiptMessage, { type ReceiptMessageState } from "./receipt-message";

type Message =
  | { id: string; role: "user"; kind: "text"; text: string }
  | { id: string; role: "user"; kind: "image"; previewUrl: string; caption: string }
  | {
      id: string;
      role: "assistant";
      kind: "text";
      text: string;
      toolCalls: ToolCall[];
      pending: boolean;
    }
  | {
      id: string;
      role: "assistant";
      kind: "receipt";
      state: ReceiptMessageState;
    };

type ToolCall = {
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
};

type VoiceState = "idle" | "recording" | "transcribing" | "error";

const STARTERS = [
  "What's my balance and what did I spend on recently?",
  "Top me up €500 from Sugar Daddy",
  "I just got a €500 bonus — help me split it into savings, stocks, and fun money",
  "Create a sub-account called Emergency Savings",
];

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || isStreaming) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      kind: "text",
      text,
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
      for await (const evt of streamChat(sessionId, text)) {
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

  async function reset() {
    await resetChat(sessionId);
    setMessages([]);
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto -mx-6 px-6 space-y-5 pb-6">
        {!hasMessages ? (
          <Starters hero={hero} onPick={send} />
        ) : (
          messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
        )}
      </div>

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
          disabled={voice !== "idle"}
        />
        <MicButton state={voice} error={voiceError} onToggle={toggleMic} />
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
            voice === "recording"
              ? "Listening…"
              : voice === "transcribing"
                ? "Transcribing…"
                : "Ask Teller anything about your money…"
          }
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted px-2 py-1.5 leading-relaxed max-h-40"
          disabled={isStreaming || voice !== "idle"}
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
            disabled={isStreaming || voice !== "idle" || !input.trim()}
            className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-[var(--accent-contrast)] transition-colors hover:bg-accent-hover disabled:opacity-30"
          >
            {isStreaming ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Starters({ hero, onPick }: { hero: boolean; onPick: (s: string) => void }) {
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
              Your bunq co-pilot. Talk to me, type to me, or snap a receipt — I&apos;ll handle the rest.
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
        <li>
          <Link
            href="/claim"
            className="group flex items-center justify-between gap-3 w-full text-left text-sm px-4 py-3 rounded-2xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] hover:bg-[var(--accent-subtle)] transition-colors"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span
                className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-accent text-[var(--accent-contrast)] shrink-0"
                aria-hidden
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </span>
              <span className="truncate">I have a claim — phone, travel, or something else</span>
            </span>
            <span className="text-muted text-xs group-hover:text-foreground transition-colors shrink-0">
              →
            </span>
          </Link>
        </li>
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

function MessageRow({ msg }: { msg: Message }) {
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

function CameraButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
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
}: {
  state: VoiceState;
  error: string | null;
  onToggle: () => void;
}) {
  const active = state === "recording";
  const busy = state === "transcribing";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      title={
        state === "recording"
          ? "Stop recording"
          : state === "transcribing"
            ? "Transcribing…"
            : error ?? "Hold to speak"
      }
      aria-label={active ? "Stop recording" : "Start voice input"}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
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
