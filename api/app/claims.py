"""
Insurance claim triage pipeline.

Flow:
  1. Transcribe the user's voice note (AWS Transcribe).
  2. Pull recent bunq transactions (verify the purchase exists).
  3. Ship the image + transcript + transactions + policy clause to Claude
     with a single forced `record_claim_decision` tool call.
  4. If Claude approves, fire a sandbox payout via Sugar Daddy (simulates
     the insurance transfer).

Claude does the vision analysis, damage assessment, transcript parsing,
transaction matching, and policy application in one shot. One API call,
many signals — exactly the "multimodal does everything" pitch.
"""

from __future__ import annotations

import base64
import json
from typing import Any

from . import bunq_service, llm, transcribe

# --------------------------------------------------------------------------
# Policy (hardcoded — in production bunq would look up the user's plan)
# --------------------------------------------------------------------------

COVERAGE_POLICIES: dict[str, str] = {
    "phone": (
        "bunq Pro/Elite Device Insurance: accidental damage to phones, laptops, and tablets "
        "up to €500/year after €25 deductible. Excludes: intentional damage, normal wear, "
        "jailbreaking, and water damage on non-waterproof devices. Proof of purchase on the "
        "bunq account required."
    ),
    "travel": (
        "bunq Elite Travel Insurance: trip delays >4 h pay €100 flat. Lost luggage up to "
        "€1500 with receipts. Medical emergencies abroad up to €50000. Cancelled flights due "
        "to strikes/weather covered up to ticket cost (€1000 cap). Proof of bookings on bunq "
        "account required."
    ),
    "default": (
        "bunq Elite combined coverage: (a) device damage up to €500/year with €25 deductible, "
        "excludes intentional/wear/water; (b) travel delays >4 h pay €100 flat; (c) lost "
        "luggage up to €1500 with receipts; (d) medical abroad up to €50000. Purchase/booking "
        "must be traceable on the bunq account."
    ),
}


# --------------------------------------------------------------------------
# Tool schema — forces Claude to emit a machine-parseable verdict
# --------------------------------------------------------------------------

CLAIM_TOOL: dict[str, Any] = {
    "name": "record_claim_decision",
    "description": (
        "Record your triage decision for this insurance claim. Call exactly once "
        "after analysing the photo, voice transcript, bunq transactions, and policy."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "decision": {
                "type": "string",
                "enum": ["approve", "reject", "escalate"],
                "description": (
                    "approve: clearly covered, within limits, purchase evidenced. "
                    "reject: clearly excluded or unsupported. "
                    "escalate: needs a human — high amount, ambiguous, contradictory evidence."
                ),
            },
            "damage_type": {
                "type": "string",
                "description": "Short phrase, e.g. 'cracked phone screen', 'train delay 5h', 'broken headphones'.",
            },
            "severity": {
                "type": "string",
                "enum": ["low", "medium", "high"],
            },
            "claim_amount_eur": {
                "type": "number",
                "description": "Estimated cost of the damage / the amount the user is asking for.",
            },
            "deductible_eur": {
                "type": "number",
                "description": "Deductible applied from the policy. 0 if none.",
                "default": 0,
            },
            "payout_eur": {
                "type": "number",
                "description": "Final payout in EUR. 0 for reject or escalate.",
            },
            "matched_payment_id": {
                "type": ["integer", "null"],
                "description": "bunq payment id matching the purchase in question, if found.",
            },
            "policy_clause": {
                "type": "string",
                "description": "Specific policy clause you applied.",
            },
            "reason": {
                "type": "string",
                "description": (
                    "Customer-facing 1–2 sentence explanation. Warm, specific, no legalese. "
                    "On approve: confirm what's happening. On reject: state which clause and why."
                ),
            },
            "confidence": {
                "type": "number",
                "description": "0–1 self-rating of how sure you are.",
            },
        },
        "required": [
            "decision",
            "damage_type",
            "severity",
            "claim_amount_eur",
            "payout_eur",
            "reason",
            "confidence",
        ],
    },
}


SYSTEM = """You are the bunq claims triage AI. You process real insurance claims from bunq customers by analysing:
1. A photo of the damage, receipt, or delay notice.
2. The voice transcript of what happened.
3. The customer's recent bunq transactions.
4. The applicable policy clause.

Be conservative but reasonable.

APPROVE when: damage is clearly covered; claim amount is within policy limits; AND the underlying purchase appears in the recent bunq transactions (e.g. "iPhone" claim matches a Fonq / Apple Store payment). Trivially obvious small-amount approvals are the target of this system.

REJECT only when: the damage is **clearly** excluded by the policy (intentional, normal wear, or an out-of-scope cause like water damage on a non-waterproof device) OR the claim exceeds the policy limit by a lot. Do not reject purely because no purchase was found — that's not enough evidence to reject, it's a reason to escalate.

ESCALATE when: the item the user is claiming for has **no matching purchase** on the bunq transactions and no obvious policy exclusion (e.g. user claims an iPad but there is no tablet or electronics purchase visible); ambiguous damage; high severity; large payouts; contradictory evidence between photo and voice; low confidence overall. When escalating for missing purchase evidence, phrase it warmly: "I don't see that purchase on your bunq account yet — let me loop in a human to help sort this out."

Apply deductibles correctly. Example: policy says "up to €500 after €25 deductible" and user claims €120 → payout = €95.

Your `reason` text will be shown to the customer. Keep it human: "Looks like a crack along the top of the screen, covered under Pro Device Insurance. We'll refund €95 (your €120 claim minus the €25 deductible) — it'll hit your bunq account in a few seconds."

Call `record_claim_decision` exactly once."""


# --------------------------------------------------------------------------
# Orchestrator
# --------------------------------------------------------------------------


def process_claim(
    image_bytes: bytes,
    image_mime: str,
    audio_bytes: bytes | None = None,
    audio_format: str = "webm",
    coverage: str = "default",
    transcript_text: str | None = None,
) -> dict[str, Any]:
    """Run the claim triage pipeline.

    If `transcript_text` is provided, the AWS Transcribe step is skipped — this
    is the fast path the chat UI uses after it has already shown a "Here's what
    I heard" review card to the user. Falling back to `audio_bytes` works when
    no transcript is available yet.
    """
    # Step 1: transcribe voice (or skip if we already have the text)
    if transcript_text and transcript_text.strip():
        transcript = transcript_text.strip()
        t: dict[str, Any] = {"text": transcript}
    elif audio_bytes:
        t = transcribe.transcribe_audio(audio_bytes, media_format=audio_format)
        transcript = t.get("text") or ""
    else:
        raise ValueError("Either transcript_text or audio_bytes is required")

    # Step 2: recent transactions for context
    client = bunq_service.get_client()
    account_id = client.get_primary_account_id()
    txs = bunq_service.list_transactions(account_id, count=50)
    tx_context = [
        {
            "id": tx["id"],
            "amount": tx["amount"],
            "created": (tx.get("created") or "")[:10],
            "counterparty": tx.get("counterparty"),
            "description": tx.get("description"),
        }
        for tx in txs[:30]
    ]

    # Step 3: policy
    policy = COVERAGE_POLICIES.get(coverage, COVERAGE_POLICIES["default"])

    # Step 4: vision + LLM decision in one Claude call (via Bedrock by default)
    client = llm.claude()
    b64 = base64.standard_b64encode(image_bytes).decode()

    user_content: list[dict[str, Any]] = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": image_mime, "data": b64},
        },
        {
            "type": "text",
            "text": (
                f"VOICE TRANSCRIPT:\n{transcript or '(no transcript)'}\n\n"
                f"APPLICABLE POLICY ({coverage}):\n{policy}\n\n"
                f"RECENT BUNQ TRANSACTIONS (last 30, newest first):\n"
                f"{json.dumps(tx_context, default=str, indent=2)}\n\n"
                f"Assess this claim now and call record_claim_decision."
            ),
        },
    ]

    resp = client.messages.create(
        model=llm.model(),
        max_tokens=1024,
        system=SYSTEM,
        tools=[CLAIM_TOOL],
        tool_choice={"type": "tool", "name": "record_claim_decision"},
        messages=[{"role": "user", "content": user_content}],
    )

    decision: dict[str, Any] | None = None
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and getattr(block, "name", "") == "record_claim_decision":
            decision = dict(block.input or {})
            break
    if not decision:
        raise RuntimeError("Claude did not emit a claim decision")

    decision.setdefault("deductible_eur", 0)
    decision.setdefault("policy_clause", policy.split(".")[0])

    # Step 5: if approved and payout > 0, execute via Sugar Daddy (sandbox-only).
    # In production this would be a real transfer from the insurer's account.
    payout: dict[str, Any] | None = None
    if decision.get("decision") == "approve":
        amount = float(decision.get("payout_eur") or 0)
        if amount > 0:
            try:
                payout = bunq_service.request_sandbox_money(amount)
                payout["amount_eur"] = amount
            except Exception as exc:
                payout = {"error": f"{type(exc).__name__}: {exc}"}

    return {
        "decision": decision,
        "transcript": {
            "text": transcript,
            "language": t.get("language"),
            "confidence": t.get("confidence"),
            "duration_s": t.get("duration_s"),
        },
        "policy": {"coverage": coverage, "clause": policy},
        "payout": payout,
        "context": {"transactions_considered": len(tx_context)},
    }
