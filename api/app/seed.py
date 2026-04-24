"""
Seed the sandbox account with a realistic balance + transaction history so
claims actually find purchases to match against.

bunq sandbox caps `request_inquiry` from Sugar Daddy at €500 per call, so
we batch top-ups (e.g. 40 × €500 → €20 000) and then "spend" some of that
back to a few merchants. The merchant payments go to Sugar Daddy with
named counterparties — that's the only counterparty the sandbox accepts.

Idempotency: we mark a "seeded" flag in `{STATE_DIR}/.bunq_seeded` so the
auto-bootstrap doesn't re-seed every restart.
"""

from __future__ import annotations

import time
from pathlib import Path

from . import bunq_service
from .config import get_settings

# How much to deposit, capped at €500 per request_inquiry.
TARGET_BALANCE_EUR = 20_000.0
DEPOSIT_PER_REQUEST = 500.0

# Realistic spending pattern. Total here should leave ~€19K-ish on balance
# after subtraction. Each entry is (amount_eur, merchant_name, description,
# days_ago).
SPEND: list[tuple[float, str, str, int]] = [
    (1_249.00, "Fonq Electronics", "iPhone 16 Pro · 256GB", 12),
    (1_799.00, "Apple Store Amsterdam", "MacBook Air M3 13\"", 28),
    (399.00, "Sony Center", "WH-1000XM5 headphones", 21),
    (189.00, "KLM Royal Dutch", "Flight AMS → BER 4 Mar", 8),
    (74.20, "Vapiano Centraal", "Lunch with Lisa", 3),
    (52.30, "bol.com", "Books — fiction bundle", 6),
    (34.20, "Albert Heijn", "Groceries", 2),
    (14.80, "Uber", "Ride home Saturday", 4),
    (8.90, "Starbucks Leidseplein", "Flat white + croissant", 1),
    (4.50, "Albert Heijn To Go", "Coffee + banana", 0),
]


def _seeded_flag() -> Path:
    return Path(get_settings().state_dir) / ".bunq_seeded"


def already_seeded() -> bool:
    return _seeded_flag().exists()


def mark_seeded() -> None:
    _seeded_flag().write_text("ok")


def top_up(amount_eur: float) -> None:
    """Run as many `request_inquiry` calls as needed to credit `amount_eur`."""
    rounds = int(amount_eur // DEPOSIT_PER_REQUEST)
    remainder = amount_eur - rounds * DEPOSIT_PER_REQUEST
    for _ in range(rounds):
        bunq_service.request_sandbox_money(DEPOSIT_PER_REQUEST)
        time.sleep(0.6)  # respect rate limits (5 POSTs / 3s)
    if remainder >= 1:
        bunq_service.request_sandbox_money(remainder)
        time.sleep(0.6)


def send_payment(amount_eur: float, merchant: str, description: str) -> dict:
    """Send `amount_eur` to Sugar Daddy with a merchant-shaped counterparty
    name and description. The sandbox treats Sugar Daddy as the only
    valid counterparty alias, so we override the display name."""
    client = bunq_service.get_client()
    account_id = client.get_primary_account_id()
    resp = client.post(
        f"user/{client.user_id}/monetary-account/{account_id}/payment",
        {
            "amount": {"value": f"{amount_eur:.2f}", "currency": "EUR"},
            "counterparty_alias": {
                "type": "EMAIL",
                "value": "sugardaddy@bunq.com",
                "name": merchant,
            },
            "description": description,
        },
    )
    return {
        "id": resp[0]["Id"]["id"] if resp else None,
        "merchant": merchant,
        "description": description,
        "amount_eur": amount_eur,
    }


def seed(*, force: bool = False) -> dict:
    """Run the full seed: top-up to TARGET_BALANCE_EUR, then create the
    realistic spending history. Idempotent unless `force=True`."""
    if already_seeded() and not force:
        return {"ok": True, "skipped": True, "reason": "already seeded"}

    # 1) top up
    top_up(TARGET_BALANCE_EUR)

    # 2) realistic spend
    payments: list[dict] = []
    for amount, merchant, description, _days_ago in SPEND:
        try:
            payments.append(send_payment(amount, merchant, description))
            time.sleep(0.6)
        except Exception as exc:  # don't blow up the whole seed for one failure
            payments.append({"merchant": merchant, "error": f"{type(exc).__name__}: {exc}"})

    mark_seeded()

    # Snapshot resulting balance
    accounts = bunq_service.list_accounts()
    balance = accounts[0].get("balance") if accounts else None
    return {
        "ok": True,
        "balance_eur": balance,
        "deposited_eur": TARGET_BALANCE_EUR,
        "payments": payments,
    }
