"""
Teller agent — a thin Claude tool-use loop.

Responsibilities:
  * keep a conversation (list of messages) between user and assistant
  * call Claude with our bunq tool specs
  * when Claude asks for a tool, run it and feed the result back
  * stream everything out as SSE events to the frontend

Events yielded:
  {"type": "text_delta", "text": "..."}            incremental assistant prose
  {"type": "tool_use", "name": "...", "input": {}} Claude is about to call a tool
  {"type": "tool_result", "name": "...", "output": ...}  tool's return value
  {"type": "tool_error", "name": "...", "error": "..."}  tool raised
  {"type": "done"}                                  turn finished
  {"type": "error", "error": "..."}                 fatal error

Keeping turn history server-side means the Next.js client just sends user
messages; it doesn't need to reconstruct anthropic's message format.
"""

from __future__ import annotations

import json
import traceback
from collections.abc import Iterator
from typing import Any

import anthropic

from . import tool_defs
from .config import get_settings

SYSTEM_PROMPT = """You are Teller, an AI co-pilot for the bunq bank app.
You help the user understand and manage their money. You can hear commands, see receipts, and take actions on the user's real bunq account through tools.

# Output format (important!)
Your assistant replies are rendered as structured cards, not one long paragraph. Use these sections — include only those that apply. Never more than 3 cards.

## TL;DR
One concise sentence. What's happening, what you found, or what you did. Always include this.

## Steps
Bullet list of concrete actions or facts. One line each. Use signed EUR amounts (e.g. "−€28.40", "+€500.00"). Skip this section for simple acknowledgements.

## Why
One or two lines of reasoning — only if it adds real clarity. Skip if obvious.

## Next
One to three short follow-up suggestions the user might want. Skip when the task is complete or nothing else makes sense.

If the reply is a plain one-liner acknowledgement ("Done — moved €300 to Emergency Savings."), skip the section headings entirely and just say it. Cards are a tool, not a rule.

# Principles
1. Every action matters. Transactions are real (sandbox or production — same API). Never call a money-moving tool without the user's explicit confirmation ("yes", "do it", "go ahead"). Ambiguous replies mean no.
2. Be concise. Every card is scannable, not an essay.
3. Show your work. Before you call a mutating tool, state the exact plan in one sentence in your TL;DR (e.g. "I'll move €300 from Main → Emergency Savings, labelled 'Bonus split'."), then ask and wait.
4. Read-only tools (whoami, list_accounts, list_transactions) are fine to call whenever helpful — use them eagerly to ground your answers in real data instead of guessing.
5. Amounts are always EUR and signed in your prose: "−€12.40" for outgoing, "+€500.00" for incoming.
6. If a tool returns an error, surface it honestly in the TL;DR; don't pretend it worked.

# Context
- The user is on a bunq sandbox account. Sugar Daddy can top them up on request.
- You are running on Claude via an agent loop. Prefer fewer, well-chosen tool calls to long chains.
"""


class TellerAgent:
    def __init__(self, model: str | None = None) -> None:
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY not configured. Add it to api/.env and restart the backend."
            )
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = model or settings.anthropic_model
        self.messages: list[dict[str, Any]] = []

    def add_user_message(self, text: str) -> None:
        self.messages.append({"role": "user", "content": text})

    def run_turn(self) -> Iterator[dict[str, Any]]:
        """Run one assistant turn. Loops internally as long as Claude keeps
        calling tools; yields SSE events throughout."""
        try:
            while True:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=2048,
                    system=SYSTEM_PROMPT,
                    tools=tool_defs.TOOL_SPECS,
                    messages=self.messages,
                )

                assistant_content: list[dict[str, Any]] = []
                tool_uses: list[dict[str, Any]] = []

                for block in response.content:
                    if block.type == "text":
                        assistant_content.append({"type": "text", "text": block.text})
                        for chunk in _chunk_text(block.text):
                            yield {"type": "text_delta", "text": chunk}
                    elif block.type == "tool_use":
                        tu = {
                            "type": "tool_use",
                            "id": block.id,
                            "name": block.name,
                            "input": block.input,
                        }
                        assistant_content.append(tu)
                        tool_uses.append(tu)
                        yield {"type": "tool_use", "name": block.name, "input": block.input}

                self.messages.append({"role": "assistant", "content": assistant_content})

                if response.stop_reason != "tool_use" or not tool_uses:
                    yield {"type": "done"}
                    return

                tool_results: list[dict[str, Any]] = []
                for tu in tool_uses:
                    try:
                        output = tool_defs.run_tool(tu["name"], tu["input"] or {})
                        print(f"[agent] tool {tu['name']}({tu['input']}) → {_truncate(output)}")
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": tu["id"],
                                "content": json.dumps(output, default=str),
                            }
                        )
                        yield {"type": "tool_result", "name": tu["name"], "output": output}
                    except Exception as exc:
                        err = f"{type(exc).__name__}: {exc}"
                        print(f"[agent] tool {tu['name']} FAILED: {err}\n{traceback.format_exc()}")
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": tu["id"],
                                "content": json.dumps({"error": err}),
                                "is_error": True,
                            }
                        )
                        yield {"type": "tool_error", "name": tu["name"], "error": err}

                self.messages.append({"role": "user", "content": tool_results})

        except anthropic.APIError as exc:
            yield {"type": "error", "error": f"anthropic: {exc}"}
        except Exception as exc:
            yield {"type": "error", "error": f"{type(exc).__name__}: {exc}"}


def _chunk_text(text: str, size: int = 24) -> Iterator[str]:
    """Tiny helper to simulate streaming for now. When we switch to real SSE
    streaming from Anthropic (`with client.messages.stream(...)`) this goes away."""
    for i in range(0, len(text), size):
        yield text[i : i + size]


def _truncate(obj: Any, n: int = 200) -> str:
    s = json.dumps(obj, default=str)
    return s if len(s) <= n else s[:n] + "…"
