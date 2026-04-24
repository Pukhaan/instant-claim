"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { streamChat, resetChat, type ChatEvent } from "@/lib/chat";

type Message =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      toolCalls: ToolCall[];
      pending: boolean;
    };

type ToolCall = {
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
};

const STARTERS = [
  "What's my balance and what did I spend on recently?",
  "Top me up €500 from Sugar Daddy",
  "I just got a €500 bonus — help me split it into savings, stocks, and fun money",
  "Create a sub-account called Emergency Savings",
];

export default function ChatView() {
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || isStreaming) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    const asst: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
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
      setMessages((m) => m.map((msg) => (msg.id === asst.id && msg.role === "assistant" ? { ...msg, pending: false } : msg)));
      setIsStreaming(false);
    }
  }

  async function reset() {
    await resetChat(sessionId);
    setMessages([]);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto -mx-6 px-6 space-y-5 pb-6">
        {messages.length === 0 ? (
          <Starters onPick={send} />
        ) : (
          messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
        )}
      </div>

      <form
        className="sticky bottom-4 flex items-end gap-3 bg-[var(--card)] rounded-2xl border border-[var(--border)] p-3 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask Teller anything about your money…"
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted px-2 py-1.5 leading-relaxed max-h-40"
          disabled={isStreaming}
        />
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
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
            disabled={isStreaming || !input.trim()}
            className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-[var(--accent-contrast)] transition-colors hover:bg-accent-hover disabled:opacity-30"
          >
            {isStreaming ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Starters({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="py-12 md:py-16">
      <h2 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight mb-3 leading-tight">
        What do you want to do with your money?
      </h2>
      <p className="text-muted text-pretty mb-8 leading-relaxed max-w-xl">
        Teller can list accounts, read transactions, move money between your sub-accounts, and more.
        Try one of these to start.
      </p>
      <ul className="space-y-2">
        {STARTERS.map((s) => (
          <li key={s}>
            <button
              onClick={() => onPick(s)}
              className="w-full text-left text-sm px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-subtle)] transition-colors"
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
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-accent text-[var(--accent-contrast)] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {msg.toolCalls.map((tc, i) => (
        <ToolCallRow key={i} call={tc} />
      ))}
      {(msg.text || msg.pending) && (
        <div className="max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {msg.text}
          {msg.pending && <span className="inline-block ml-1 animate-pulse text-muted">▍</span>}
        </div>
      )}
    </div>
  );
}

function ToolCallRow({ call }: { call: ToolCall }) {
  const label = humanTool(call.name);
  const status = call.error ? "error" : call.output !== undefined ? "done" : "running";
  return (
    <details className="group rounded-xl border border-[var(--border)] bg-[var(--card)]">
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
    const { amount_eur, description } = call.input as { amount_eur?: number; description?: string };
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
    if (msg.id !== asstId || msg.role !== "assistant") return msg;
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
