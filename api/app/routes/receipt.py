"""/receipt — image upload, vision extraction, transaction match + persist."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from .. import receipts

router = APIRouter()

MAX_IMAGE_BYTES = 6 * 1024 * 1024
ALLOWED_MEDIA = {"image/jpeg", "image/png", "image/webp", "image/heic"}


@router.post("/receipt")
async def process_receipt(image: UploadFile = File(...)) -> dict[str, Any]:
    media_type = (image.content_type or "").split(";")[0].strip() or "image/jpeg"
    if media_type == "image/heic":
        media_type = "image/jpeg"  # Claude accepts jpeg; phones often send heic
    if media_type not in ALLOWED_MEDIA:
        raise HTTPException(400, f"Unsupported image type: {media_type}")

    data = await image.read()
    if not data:
        raise HTTPException(400, "Empty image")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, f"Image too large (max {MAX_IMAGE_BYTES // 1024 // 1024} MB)")

    try:
        extracted = receipts.extract_receipt(data, media_type=media_type)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"extraction failed: {type(exc).__name__}: {exc}") from exc

    match = None
    try:
        match = receipts.match_transaction(extracted)
    except Exception as exc:
        match = {"error": f"match failed: {type(exc).__name__}: {exc}"}

    return {"extracted": extracted, "match": match}


class ConfirmRequest(BaseModel):
    payment_id: int
    extracted: dict[str, Any]


@router.post("/receipt/confirm")
def confirm_receipt(req: ConfirmRequest) -> dict[str, Any]:
    record = receipts.save_enrichment(req.payment_id, req.extracted)
    return {"ok": True, "enrichment": record}


@router.get("/enrichments")
def get_enrichments() -> dict[str, dict[str, Any]]:
    return receipts.list_enrichments()
