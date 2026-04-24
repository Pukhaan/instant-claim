"""
AWS service availability probe.

The workshop account has restrictive IAM. Rather than guess which services are
allowed, this module runs one lightweight call per service (STS, Bedrock,
Transcribe, Polly, S3) and caches the result so `/health` can show truthful
per-service dots in the UI.
"""

from __future__ import annotations

import threading
import time
from typing import Any

from .config import get_settings

_lock = threading.Lock()
_cache: dict[str, Any] | None = None
_cache_ts: float = 0.0
_CACHE_TTL_S = 60.0


def _boto3_kwargs() -> dict[str, Any]:
    s = get_settings()
    kwargs: dict[str, Any] = {"region_name": s.aws_region or s.aws_default_region}
    if s.aws_access_key_id and s.aws_secret_access_key:
        kwargs["aws_access_key_id"] = s.aws_access_key_id
        kwargs["aws_secret_access_key"] = s.aws_secret_access_key
        if s.aws_session_token:
            kwargs["aws_session_token"] = s.aws_session_token
    return kwargs


def _probe_once() -> dict[str, Any]:
    """Runs the actual probes. Each service is independent so one failure
    doesn't mask the others."""
    s = get_settings()
    result: dict[str, Any] = {
        "region": s.aws_region or s.aws_default_region,
        "has_credentials": bool(s.aws_access_key_id and s.aws_secret_access_key),
        "services": {},
        "identity": None,
    }
    if not result["has_credentials"]:
        return result

    try:
        import boto3  # lazy import; boto3 is slow to load at startup
        from botocore.exceptions import BotoCoreError, ClientError
    except Exception as exc:  # pragma: no cover
        result["error"] = f"boto3 import: {exc}"
        return result

    kwargs = _boto3_kwargs()

    # Identity
    try:
        sts = boto3.client("sts", **kwargs)
        ident = sts.get_caller_identity()
        result["identity"] = {
            "account": ident.get("Account"),
            "arn": ident.get("Arn"),
            "user_id": ident.get("UserId"),
        }
    except (ClientError, BotoCoreError) as exc:
        result["identity_error"] = str(exc)

    # Each probe returns (ok, error_msg)
    checks = [
        ("bedrock", lambda: boto3.client("bedrock", **kwargs).list_foundation_models(byOutputModality="TEXT")),
        ("transcribe", lambda: boto3.client("transcribe", **kwargs).list_transcription_jobs(MaxResults=1)),
        ("polly", lambda: boto3.client("polly", **kwargs).describe_voices(LanguageCode="en-US")),
        ("s3", lambda: boto3.client("s3", **kwargs).list_buckets()),
    ]

    for name, fn in checks:
        try:
            fn()
            result["services"][name] = {"ok": True}
        except (ClientError, BotoCoreError) as exc:
            # Fine-grained IAM errors are usually `AccessDenied`. Keep the message short.
            msg = str(exc)
            if len(msg) > 200:
                msg = msg[:200] + "…"
            result["services"][name] = {"ok": False, "error": msg}
        except Exception as exc:
            result["services"][name] = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

    return result


def probe(force: bool = False) -> dict[str, Any]:
    """Cached probe. Re-runs at most every `_CACHE_TTL_S` seconds."""
    global _cache, _cache_ts
    now = time.time()
    if not force and _cache is not None and (now - _cache_ts) < _CACHE_TTL_S:
        return _cache
    with _lock:
        if force or _cache is None or (now - _cache_ts) >= _CACHE_TTL_S:
            _cache = _probe_once()
            _cache_ts = now
        return _cache
