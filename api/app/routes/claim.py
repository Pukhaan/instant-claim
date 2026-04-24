"""/claim — one-shot insurance claim triage (photo + voice in, decision out)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import claims

router = APIRouter()

MAX_IMAGE_BYTES = 6 * 1024 * 1024
MAX_AUDIO_BYTES = 8 * 1024 * 1024

_IMAGE_OK = {"image/jpeg", "image/png", "image/webp", "image/heic"}

_AUDIO_FORMAT: dict[str, str] = {
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


@router.post("/claim")
async def submit_claim(
    image: UploadFile = File(...),
    audio: UploadFile | None = File(None),
    transcript: str | None = Form(None),
    coverage: str = Form("default"),
) -> dict[str, Any]:
    image_mime = (image.content_type or "image/jpeg").split(";")[0].strip().lower()
    if image_mime == "image/heic":
        image_mime = "image/jpeg"
    if image_mime not in _IMAGE_OK:
        raise HTTPException(400, f"Unsupported image type: {image_mime!r}")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(400, "Empty image")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(413, f"Image too large (max {MAX_IMAGE_BYTES // 1024 // 1024} MB)")

    audio_bytes: bytes | None = None
    audio_fmt = "webm"
    has_transcript = bool(transcript and transcript.strip())
    if audio is not None and audio.filename:
        audio_mime = (audio.content_type or "audio/webm").split(";")[0].strip().lower()
        mapped = _AUDIO_FORMAT.get(audio_mime)
        if not mapped:
            raise HTTPException(400, f"Unsupported audio type: {audio_mime!r}")
        audio_fmt = mapped
        audio_bytes = await audio.read()
        if not audio_bytes:
            audio_bytes = None
        elif len(audio_bytes) > MAX_AUDIO_BYTES:
            raise HTTPException(413, f"Audio too large (max {MAX_AUDIO_BYTES // 1024 // 1024} MB)")

    if not has_transcript and not audio_bytes:
        raise HTTPException(400, "Either `audio` or `transcript` is required")

    try:
        return claims.process_claim(
            image_bytes=image_bytes,
            image_mime=image_mime,
            audio_bytes=audio_bytes,
            audio_format=audio_fmt,
            coverage=coverage,
            transcript_text=transcript if has_transcript else None,
        )
    except TimeoutError as exc:
        raise HTTPException(504, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"{type(exc).__name__}: {exc}") from exc
