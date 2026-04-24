"""
Fast vision classifier — given a photo, decide what flow to drop the user
into. Receipt → categorise it. Damage / loss notice → start a claim. Other →
let the chat figure it out.

One forced-tool Claude call. Same image bytes the user uploaded; no S3 round
trip needed.
"""

from __future__ import annotations

import base64
from typing import Any

from . import llm

CLASSIFY_TOOL: dict[str, Any] = {
    "name": "classify_photo",
    "description": (
        "Classify what the user is showing you so the app can route them. "
        "Call exactly once with the most likely category."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "kind": {
                "type": "string",
                "enum": ["receipt", "damage", "other"],
                "description": (
                    "receipt: paper or digital receipt / invoice / bill (categorisation flow). "
                    "damage: a broken/lost item, delay notice, accident scene, or anything that "
                    "looks like the start of an insurance claim. "
                    "other: a person, scenery, food, etc. — neither receipt nor damage."
                ),
            },
            "subject": {
                "type": "string",
                "description": (
                    "Short noun phrase for what's in the photo, customer-facing. "
                    "Examples: 'cracked iPhone screen', 'Albert Heijn receipt', "
                    "'a flight delay board', 'a smashed laptop screen'."
                ),
            },
            "summary": {
                "type": "string",
                "description": (
                    "One short sentence describing what's in the photo, customer-facing. "
                    "Used as Teller's confirmation line. e.g. 'That looks like a cracked "
                    "phone screen — let me help you file a claim.'"
                ),
            },
            "confidence": {
                "type": "number",
                "description": "0–1 self-rating of the classification.",
            },
        },
        "required": ["kind", "subject", "confidence"],
    },
}

SYSTEM = """You're a fast photo router for the bunq Teller app.
Look at the photo and call `classify_photo` once.

- `receipt` if it's any kind of paper or digital receipt, invoice, or bill.
- `damage` if it shows physical damage to an item (cracked phone, broken laptop, smashed camera), a delay/cancellation notice, a lost-item poster, an accident — anything that's the start of an insurance claim.
- `other` if it's a person, scenery, food, animal, document that's neither receipt nor claim evidence.

Subject and summary are customer-facing — keep them human and short.
"""


def classify_photo(image_bytes: bytes, image_mime: str) -> dict[str, Any]:
    client = llm.claude()
    b64 = base64.standard_b64encode(image_bytes).decode()

    resp = client.messages.create(
        model=llm.model(),
        max_tokens=512,
        system=SYSTEM,
        tools=[CLASSIFY_TOOL],
        tool_choice={"type": "tool", "name": "classify_photo"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": image_mime,
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": "Route this photo."},
                ],
            }
        ],
    )

    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and getattr(block, "name", "") == "classify_photo":
            data = dict(block.input or {})
            data.setdefault("summary", "")
            data.setdefault("subject", "")
            data.setdefault("confidence", 0.0)
            return data
    raise RuntimeError("Claude did not classify the photo")
