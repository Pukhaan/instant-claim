"""
High-level, typed banking operations on top of BunqClient.

These are the functions Claude gets to call via tool use. Each returns plain
JSON-serializable Python (dicts/lists) so the agent loop can hand them straight
back to the model without extra shaping.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any

from .bunq_client import BunqClient
from .config import get_settings

_client: BunqClient | None = None
_client_lock = threading.Lock()


def _state_dir() -> Path:
    d = Path(get_settings().state_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _sandbox_key_file() -> Path:
    return _state_dir() / ".bunq_sandbox_key"


def _context_file() -> Path:
    return _state_dir() / "bunq_context.json"


def _resolve_sandbox_api_key(env_key: str) -> str:
    """Returns the sandbox API key, auto-creating + persisting one if needed.

    Precedence: env var → {STATE_DIR}/.bunq_sandbox_key → create a new sandbox user.
    Caching the generated key means repeated restarts reuse the same sandbox
    account (and transactions), which is what you want during dev and demos.
    """
    if env_key:
        return env_key
    key_file = _sandbox_key_file()
    if key_file.exists():
        cached = key_file.read_text().strip()
        if cached:
            return cached
    new_key = BunqClient.create_sandbox_user()
    key_file.write_text(new_key)
    print(f"[bunq] created sandbox user, key cached to {key_file}")
    return new_key


def get_client() -> BunqClient:
    """Returns a singleton, authenticated BunqClient. Thread-safe bootstrap."""
    global _client
    if _client is not None:
        return _client
    with _client_lock:
        if _client is not None:
            return _client
        settings = get_settings()
        api_key = _resolve_sandbox_api_key(settings.bunq_api_key.strip())
        client = BunqClient(
            api_key=api_key,
            sandbox=settings.bunq_sandbox,
            context_file=_context_file(),
        )
        client.authenticate()
        _client = client
        return client


def whoami() -> dict[str, Any]:
    client = get_client()
    resp = client.get(f"user/{client.user_id}")
    if not resp:
        return {"user_id": client.user_id}
    for key in ("UserPerson", "UserCompany", "UserApiKey"):
        if key in resp[0]:
            user = resp[0][key]
            return {
                "user_id": user.get("id"),
                "display_name": user.get("display_name"),
                "country": user.get("country"),
                "language": user.get("language"),
            }
    return {"user_id": client.user_id}


def list_accounts() -> list[dict[str, Any]]:
    """Lists all active monetary accounts (main + sub-accounts)."""
    client = get_client()
    resp = client.get(f"user/{client.user_id}/monetary-account-bank")
    accounts = []
    for item in resp:
        acc = item.get("MonetaryAccountBank", {})
        if acc.get("status") != "ACTIVE":
            continue
        accounts.append(
            {
                "id": acc["id"],
                "description": acc.get("description", ""),
                "balance": _money(acc.get("balance")),
                "iban": _iban(acc),
                "currency": acc.get("currency"),
                "daily_limit": _money(acc.get("daily_limit")),
            }
        )
    return accounts


def list_transactions(account_id: int, count: int = 20) -> list[dict[str, Any]]:
    """Most recent payments on a given monetary account."""
    client = get_client()
    resp = client.get(
        f"user/{client.user_id}/monetary-account/{account_id}/payment",
        params={"count": count},
    )
    out = []
    for item in resp:
        p = item.get("Payment", {})
        out.append(
            {
                "id": p.get("id"),
                "created": p.get("created"),
                "amount": _money(p.get("amount")),
                "currency": p.get("amount", {}).get("currency"),
                "counterparty": p.get("counterparty_alias", {}).get("display_name"),
                "description": p.get("description", ""),
                "type": p.get("type"),
                "sub_type": p.get("sub_type"),
            }
        )
    return out


def create_sub_account(name: str, color: str = "#00E676") -> dict[str, Any]:
    """Creates a new monetary sub-account (used for savings categories)."""
    client = get_client()
    resp = client.post(
        f"user/{client.user_id}/monetary-account-bank",
        {"currency": "EUR", "description": name, "setting": {"color": color}},
    )
    return {"id": resp[0]["Id"]["id"] if resp else None, "description": name}


def move_money(
    from_account_id: int,
    to_account_id: int,
    amount_eur: float,
    description: str,
) -> dict[str, Any]:
    """Moves money between two of the user's own monetary accounts."""
    client = get_client()
    to_iban = _iban_for_account(client, to_account_id)
    if not to_iban:
        raise ValueError(f"No IBAN found for target account {to_account_id}")
    resp = client.post(
        f"user/{client.user_id}/monetary-account/{from_account_id}/payment",
        {
            "amount": {"value": f"{amount_eur:.2f}", "currency": "EUR"},
            "counterparty_alias": {"type": "IBAN", "value": to_iban["iban"], "name": to_iban["name"]},
            "description": description,
        },
    )
    return {"payment_id": resp[0]["Id"]["id"] if resp else None}


def request_sandbox_money(amount_eur: float = 500.0) -> dict[str, Any]:
    """Sandbox-only: request test money from Sugar Daddy."""
    client = get_client()
    account_id = client.get_primary_account_id()
    client.post(
        f"user/{client.user_id}/monetary-account/{account_id}/request-inquiry",
        {
            "amount_inquired": {"value": f"{amount_eur:.2f}", "currency": "EUR"},
            "counterparty_alias": {"type": "EMAIL", "value": "sugardaddy@bunq.com", "name": "Sugar Daddy"},
            "description": "Teller sandbox top-up",
            "allow_bunqme": False,
        },
    )
    return {"requested_eur": amount_eur, "from": "sugardaddy@bunq.com"}


def request_payout(
    amount_eur: float,
    description: str,
    sender_name: str = "Quvos Insurance Payout",
) -> dict[str, Any]:
    """Approved-claim payout. Routes through Sugar Daddy under the hood so it
    auto-accepts in sandbox, but overrides the displayed counterparty so the
    resulting transaction reads as `Quvos Insurance Payout · Claim XYZ`
    on the user's home screen."""
    client = get_client()
    account_id = client.get_primary_account_id()
    client.post(
        f"user/{client.user_id}/monetary-account/{account_id}/request-inquiry",
        {
            "amount_inquired": {"value": f"{amount_eur:.2f}", "currency": "EUR"},
            "counterparty_alias": {
                "type": "EMAIL",
                "value": "sugardaddy@bunq.com",
                "name": sender_name,
            },
            "description": description,
            "allow_bunqme": False,
        },
    )
    return {
        "payout_eur": amount_eur,
        "sender": sender_name,
        "description": description,
    }


def register_webhook(callback_url: str) -> dict[str, Any]:
    """Registers a notification-filter URL for real-time payment/mutation events."""
    client = get_client()
    client.post(
        f"user/{client.user_id}/notification-filter-url",
        {
            "notification_filters": [
                {"category": "PAYMENT", "notification_target": callback_url},
                {"category": "MUTATION", "notification_target": callback_url},
            ],
        },
    )
    return {"callback_url": callback_url, "categories": ["PAYMENT", "MUTATION"]}


def _money(obj: dict | None) -> float | None:
    if not obj:
        return None
    try:
        return float(obj.get("value"))
    except (TypeError, ValueError):
        return None


def _iban(account: dict) -> str | None:
    for alias in account.get("alias", []):
        if alias.get("type") == "IBAN":
            return alias.get("value")
    return None


def _iban_for_account(client: BunqClient, account_id: int) -> dict | None:
    resp = client.get(f"user/{client.user_id}/monetary-account-bank/{account_id}")
    if not resp:
        return None
    acc = resp[0].get("MonetaryAccountBank", {})
    for alias in acc.get("alias", []):
        if alias.get("type") == "IBAN":
            return {"iban": alias["value"], "name": alias.get("name", acc.get("description", ""))}
    return None
