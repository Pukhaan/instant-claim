"""
/chat — Server-Sent Events streaming chat endpoint.

Design:
- Sessions are kept in memory keyed by a client-chosen session_id. That's fine
  for a hackathon demo (single backend instance, single user). The history is
  long-lived across turns so Claude sees the full conversation.
- Each POST /chat starts one assistant turn and streams events until "done".
- Frontend reads `text/event-stream` and renders as it goes.
"""

from __future__ import annotations

import json
import threading
from collections.abc import Iterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..agent import TellerAgent

router = APIRouter()

_sessions: dict[str, TellerAgent] = {}
_sessions_lock = threading.Lock()


class ChatRequest(BaseModel):
    session_id: str
    message: str


def _get_or_create_agent(session_id: str) -> TellerAgent:
    with _sessions_lock:
        agent = _sessions.get(session_id)
        if agent is None:
            agent = TellerAgent()
            _sessions[session_id] = agent
        return agent


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@router.post("/chat")
def chat(req: ChatRequest) -> StreamingResponse:
    try:
        agent = _get_or_create_agent(req.session_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    agent.add_user_message(req.message)

    def stream() -> Iterator[str]:
        try:
            for event in agent.run_turn():
                yield _sse(event)
        except Exception as exc:
            yield _sse({"type": "error", "error": f"{type(exc).__name__}: {exc}"})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/chat/reset")
def reset(req: ChatRequest) -> dict:
    with _sessions_lock:
        _sessions.pop(req.session_id, None)
    return {"ok": True}
