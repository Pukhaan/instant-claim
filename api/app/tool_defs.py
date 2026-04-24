"""
Tool schemas exposed to Claude. Each one maps 1:1 to a function in bunq_service.

Keep descriptions concrete and action-oriented — these are the only context
Claude gets about what each tool does, and they directly shape how often the
agent picks the right tool for the right question.
"""

from __future__ import annotations

from typing import Any

from . import bunq_service

# --------------------------------------------------------------------------
# Tool specs (Anthropic tool-use format)
# --------------------------------------------------------------------------

TOOL_SPECS: list[dict[str, Any]] = [
    {
        "name": "whoami",
        "description": "Return the current bunq user's basic profile (display name, country, language). "
        "Use this when the user asks 'who am I' or you need to personalise a reply.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "list_accounts",
        "description": "List the user's active monetary accounts (main account + any savings sub-accounts), "
        "including id, description, EUR balance, and IBAN. Always call this before referring to account "
        "balances or proposing a money movement so you have current account ids.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "list_transactions",
        "description": "List the most recent payments on a specific account. Returns a list with id, "
        "created time, amount (negative for outgoing), counterparty, and description.",
        "input_schema": {
            "type": "object",
            "properties": {
                "account_id": {
                    "type": "integer",
                    "description": "The monetary account id (from list_accounts).",
                },
                "count": {
                    "type": "integer",
                    "description": "How many recent transactions to return. Default 20. Max 200.",
                    "default": 20,
                },
            },
            "required": ["account_id"],
        },
    },
    {
        "name": "create_sub_account",
        "description": "Create a new EUR monetary sub-account (for savings goals, category budgeting, etc.). "
        "Destructive-ish: creates a new bank account on bunq. Only call AFTER the user has explicitly "
        "said yes to creating it.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Human-readable description for the account, e.g. 'Emergency Savings' or 'Stocks'.",
                },
                "color": {
                    "type": "string",
                    "description": "Hex colour for the bunq card visual, e.g. '#00E676'. Default: bunq green.",
                    "default": "#00E676",
                },
            },
            "required": ["name"],
        },
    },
    {
        "name": "move_money",
        "description": "Move money between two of the user's own monetary accounts. Fires a real bunq "
        "`/payment` call — the money actually moves. NEVER call this without the user explicitly "
        "confirming ('yes', 'do it', 'go ahead'). Before calling, state the exact plan in one sentence "
        "and WAIT for a confirmation in the next user message.",
        "input_schema": {
            "type": "object",
            "properties": {
                "from_account_id": {"type": "integer"},
                "to_account_id": {"type": "integer"},
                "amount_eur": {"type": "number", "description": "Amount in EUR, positive."},
                "description": {
                    "type": "string",
                    "description": "Short label for the transaction, e.g. 'Bonus split — savings'.",
                },
            },
            "required": ["from_account_id", "to_account_id", "amount_eur", "description"],
        },
    },
    {
        "name": "request_sandbox_money",
        "description": "Sandbox-only: ask Sugar Daddy for test money so there's something to play with. "
        "Useful when the user says 'top me up' or has a €0 balance.",
        "input_schema": {
            "type": "object",
            "properties": {
                "amount_eur": {"type": "number", "default": 500.0},
            },
        },
    },
]


# Read-only tools that are always safe to call without user confirmation.
READ_ONLY_TOOLS = {"whoami", "list_accounts", "list_transactions"}

# Map tool name → callable. Wrapped so we can validate + log.
TOOL_IMPLEMENTATIONS: dict[str, Any] = {
    "whoami": lambda: bunq_service.whoami(),
    "list_accounts": lambda: bunq_service.list_accounts(),
    "list_transactions": lambda account_id, count=20: bunq_service.list_transactions(account_id, count=count),
    "create_sub_account": lambda name, color="#00E676": bunq_service.create_sub_account(name, color=color),
    "move_money": lambda from_account_id, to_account_id, amount_eur, description: bunq_service.move_money(
        from_account_id, to_account_id, amount_eur, description
    ),
    "request_sandbox_money": lambda amount_eur=500.0: bunq_service.request_sandbox_money(amount_eur),
}


def run_tool(name: str, arguments: dict[str, Any]) -> Any:
    impl = TOOL_IMPLEMENTATIONS.get(name)
    if impl is None:
        raise ValueError(f"Unknown tool: {name}")
    return impl(**arguments)
