"""/transcribe — voice in, text out."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from .. import transcribe as transcribe_svc

router = APIRouter()

MAX_AUDIO_BYTES = 8 * 1024 * 1024  # ≈ 2 min of webm/opus at 96 kbps

# Map browser MIME types → Transcribe `MediaFormat` values.
_MEDIA_FORMAT: dict[str, str] = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/x-m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/flac": "flac",
}


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)) -> dict[str, Any]:
    media = (audio.content_type or "audio/webm").split(";")[0].strip().lower()
    fmt = _MEDIA_FORMAT.get(media)
    if not fmt:
        raise HTTPException(400, f"Unsupported audio type: {media!r}")

    data = await audio.read()
    if not data:
        raise HTTPException(400, "Empty audio")
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, f"Audio too large (max {MAX_AUDIO_BYTES // 1024 // 1024} MB)")

    try:
        return transcribe_svc.transcribe_audio(data, media_format=fmt)
    except TimeoutError as exc:
        raise HTTPException(504, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"{type(exc).__name__}: {exc}") from exc
