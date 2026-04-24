"""
Single source of truth for the Claude client.

We default to **AWS Bedrock** — the entire stack is AWS-native (Transcribe,
Polly, S3, Bedrock all in us-east-1) so the LLM call sits next to its
inputs and there's one bill, one identity, one audit trail.

`ANTHROPIC_API_KEY` is still honoured as an escape hatch (set
`USE_BEDROCK=false` to fall back to api.anthropic.com), useful for local dev
when AWS session creds expire.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import anthropic

from .config import get_settings


def _resolve_model(name: str, on_bedrock: bool) -> str:
    """Map a friendly model name to a Bedrock model id when needed."""
    if not on_bedrock:
        return name
    n = name.lower()
    if n in {"claude-sonnet-4-5", "claude-sonnet-4-5-20250929"}:
        # Cross-region inference profile id — works in us-east-1 + the workshop
        # account; falls back to plain region id if the profile isn't allowed.
        return "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
    if n in {"claude-sonnet-4", "claude-sonnet-4-20250514"}:
        return "us.anthropic.claude-sonnet-4-20250514-v1:0"
    if n in {"claude-3-7-sonnet", "claude-3-7-sonnet-20250219"}:
        return "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
    if n in {"claude-3-5-sonnet", "claude-3-5-sonnet-20241022"}:
        return "anthropic.claude-3-5-sonnet-20241022-v2:0"
    # If the user already passed a Bedrock model id ("anthropic.claude-..."),
    # leave it alone.
    return name


@lru_cache(maxsize=1)
def _is_bedrock() -> bool:
    s = get_settings()
    if not s.use_bedrock:
        return False
    return bool(s.aws_access_key_id and s.aws_secret_access_key)


@lru_cache(maxsize=2)
def _client_cached(use_bedrock: bool):
    s = get_settings()
    if use_bedrock:
        kwargs: dict[str, Any] = {
            "aws_access_key": s.aws_access_key_id,
            "aws_secret_key": s.aws_secret_access_key,
            "aws_region": s.aws_region or s.aws_default_region or "us-east-1",
        }
        if s.aws_session_token:
            kwargs["aws_session_token"] = s.aws_session_token
        return anthropic.AnthropicBedrock(**kwargs)
    if not s.anthropic_api_key:
        raise RuntimeError(
            "Neither AWS Bedrock (no AWS creds) nor Anthropic direct API "
            "(no ANTHROPIC_API_KEY) is configured."
        )
    return anthropic.Anthropic(api_key=s.anthropic_api_key)


def claude():
    """Return the active Claude client (Bedrock-flavoured by default)."""
    return _client_cached(_is_bedrock())


def model() -> str:
    """Active model id, resolved for the active backend."""
    s = get_settings()
    return _resolve_model(s.anthropic_model, _is_bedrock())


def is_bedrock() -> bool:
    return _is_bedrock()
