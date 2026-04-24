"""
Receipt processing: vision extraction, transaction matching, local enrichment store.

Why Claude forced-tool-use for extraction:
  Asking Claude for "structured JSON" in prose is brittle — it sometimes wraps
  in markdown, hallucinates keys, or adds commentary. Forcing a tool call with
  a strict input schema makes the response machine-parseable every time.

Why a local JSON store:
  bunq's public API exposes `PUT /payment/{id}` for description updates on
  some accounts but not reliably in sandbox. A local `enrichments.json`
  keyed by payment_id is portable, survives restarts, and is the natural
  place to store extra signal (merchant name, line items, receipt image
  reference) that bunq itself wouldn't capture. Dashboard merges both sources.
"""

from __future__ import annotations

import base64
import json
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import anthropic

from . import bunq_service
from .config import get_settings

ENRICHMENTS_FILE = Path("enrichments.json")
_enrichments_lock = threading.Lock()


# --------------------------------------------------------------------------
# Vision extraction
# --------------------------------------------------------------------------

RECEIPT_TOOL = {
    "name": "record_receipt",
    "description": "Record the structured contents of a receipt image.",
    "input_schema": {
        "type": "object",
        "properties": {
            "merchant": {
                "type": "string",
                "description": "Merchant / shop name as printed on the receipt.",
            },
            "total_eur": {
                "type": "number",
                "description": "Total amount in EUR as a positive number. Convert from other currencies if needed.",
            },
            "currency": {
                "type": "string",
                "description": "ISO currency of the original receipt, e.g. 'EUR'.",
                "default": "EUR",
            },
            "date": {
                "type": "string",
                "description": "Receipt date in YYYY-MM-DD, or empty string if not visible.",
            },
            "category": {
                "type": "string",
                "description": "Best-fit category from: Groceries, Dining, Transport, Entertainment, Shopping, Health, Bills, Travel, Other.",
                "enum": [
                    "Groceries",
                    "Dining",
                    "Transport",
                    "Entertainment",
                    "Shopping",
                    "Health",
                    "Bills",
                    "Travel",
                    "Other",
                ],
            },
            "items": {
                "type": "array",
                "description": "Line items, each with name and price_eur. Omit VAT/total lines.",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "price_eur": {"type": "number"},
                    },
                    "required": ["name", "price_eur"],
                },
            },
            "confidence": {
                "type": "number",
                "description": "Self-assessed extraction confidence, 0–1.",
            },
            "note": {
                "type": "string",
                "description": "Short free-text note if something is ambiguous. Empty string if not needed.",
                "default": "",
            },
        },
        "required": ["merchant", "total_eur", "category", "confidence"],
    },
}

EXTRACT_PROMPT = (
    "You're looking at a photo of a paper receipt. Extract its contents precisely. "
    "If the image is not a receipt, set merchant='(not a receipt)', total_eur=0, confidence=0. "
    "Call the `record_receipt` tool exactly once."
)


def _anthropic_client() -> anthropic.Anthropic:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY not configured. Add it to api/.env and restart the backend."
        )
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def extract_receipt(image_bytes: bytes, media_type: str = "image/jpeg") -> dict[str, Any]:
    """Extract structured receipt data from an image using Claude vision."""
    settings = get_settings()
    client = _anthropic_client()
    b64 = base64.standard_b64encode(image_bytes).decode()

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        tools=[RECEIPT_TOOL],
        tool_choice={"type": "tool", "name": "record_receipt"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": b64},
                    },
                    {"type": "text", "text": EXTRACT_PROMPT},
                ],
            }
        ],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "record_receipt":
            data = dict(block.input or {})
            data.setdefault("currency", "EUR")
            data.setdefault("date", "")
            data.setdefault("items", [])
            data.setdefault("note", "")
            return data
    raise RuntimeError("Claude did not return a record_receipt tool call")


# --------------------------------------------------------------------------
# Matching
# --------------------------------------------------------------------------


def match_transaction(
    extracted: dict[str, Any],
    *,
    amount_tolerance_eur: float = 0.02,
    days_window: int = 14,
) -> dict[str, Any] | None:
    """Find the best candidate bunq transaction for an extracted receipt.

    Strategy: walk recent transactions on the primary account. Score each by
    |amount_diff| and age; return the lowest-score match that passes both
    thresholds. Returns None if nothing plausible is nearby.
    """
    target_amount = float(extracted.get("total_eur", 0) or 0)
    if target_amount <= 0:
        return None

    client = bunq_service.get_client()
    account_id = client.get_primary_account_id()
    transactions = bunq_service.list_transactions(account_id, count=100)

    receipt_date = _parse_date(extracted.get("date"))
    now = datetime.now()

    best: tuple[float, dict[str, Any]] | None = None
    for tx in transactions:
        amount = tx.get("amount")
        if amount is None:
            continue
        # Only consider outgoing (negative) amounts — receipts are for money spent.
        if amount >= 0:
            continue
        amount_diff = abs(abs(amount) - target_amount)
        if amount_diff > amount_tolerance_eur:
            continue
        tx_date = _parse_date(tx.get("created"))
        age_days = _days_between(tx_date, receipt_date or now)
        if age_days is not None and age_days > days_window:
            continue
        score = amount_diff * 100 + (age_days or 0)
        if best is None or score < best[0]:
            best = (score, tx)

    if best is None:
        return None
    _score, tx = best
    return {
        "payment_id": tx["id"],
        "account_id": account_id,
        "amount": tx["amount"],
        "created": tx["created"],
        "counterparty": tx.get("counterparty"),
        "description": tx.get("description"),
    }


def _parse_date(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).replace("T", " ").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[: 26 if "%f" in fmt else 19 if "%S" in fmt else 10], fmt)
        except ValueError:
            continue
    return None


def _days_between(a: datetime | None, b: datetime | None) -> float | None:
    if a is None or b is None:
        return None
    return abs((a - b).total_seconds()) / 86400


# --------------------------------------------------------------------------
# Enrichment store
# --------------------------------------------------------------------------


def _load_all() -> dict[str, dict[str, Any]]:
    if not ENRICHMENTS_FILE.exists():
        return {}
    try:
        return json.loads(ENRICHMENTS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def _save_all(data: dict[str, dict[str, Any]]) -> None:
    ENRICHMENTS_FILE.write_text(json.dumps(data, indent=2, default=str))


def list_enrichments() -> dict[str, dict[str, Any]]:
    with _enrichments_lock:
        return _load_all()


def save_enrichment(payment_id: int, enrichment: dict[str, Any]) -> dict[str, Any]:
    with _enrichments_lock:
        data = _load_all()
        record = {
            **enrichment,
            "payment_id": payment_id,
            "saved_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }
        data[str(payment_id)] = record
        _save_all(data)
        return record
