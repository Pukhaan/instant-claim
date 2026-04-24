"""/classify-photo — fast vision routing for a single image."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from .. import photo_classify

router = APIRouter()

MAX_IMAGE_BYTES = 6 * 1024 * 1024
ALLOWED_MEDIA = {"image/jpeg", "image/png", "image/webp", "image/heic"}


@router.post("/classify-photo")
async def classify(image: UploadFile = File(...)) -> dict[str, Any]:
    media = (image.content_type or "image/jpeg").split(";")[0].strip().lower()
    if media == "image/heic":
        media = "image/jpeg"
    if media not in ALLOWED_MEDIA:
        raise HTTPException(400, f"Unsupported image type: {media!r}")

    data = await image.read()
    if not data:
        raise HTTPException(400, "Empty image")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, f"Image too large (max {MAX_IMAGE_BYTES // 1024 // 1024} MB)")

    try:
        return photo_classify.classify_photo(data, media)
    except Exception as exc:
        raise HTTPException(502, f"{type(exc).__name__}: {exc}") from exc
