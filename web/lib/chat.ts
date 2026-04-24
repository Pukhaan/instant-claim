export type ChatEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; output: unknown }
  | { type: "tool_error"; name: string; error: string }
  | { type: "done" }
  | { type: "error"; error: string };

export async function* streamChat(
  sessionId: string,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ session_id: sessionId, message }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    yield {
      type: "error",
      error: `${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 300)}` : ""}`,
    };
    return;
  }
  if (!res.body) {
    yield { type: "error", error: "No response body" };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data) continue;
      try {
        yield JSON.parse(data) as ChatEvent;
      } catch {
        // malformed event; skip
      }
    }
  }
}

export async function resetChat(sessionId: string): Promise<void> {
  await fetch("/api/chat/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message: "" }),
  });
}
