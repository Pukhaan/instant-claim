"""
Voice → text via AWS Transcribe.

Flow: browser uploads audio → we stash it in S3 → Transcribe batch job →
poll → parse transcript JSON → return text. Typical end-to-end latency for
a 5–10 s clip: 4–8 s. Good enough for a hackathon demo; swap for
`start_stream_transcription` later if we want sub-second.

The S3 bucket is auto-provisioned on first call with a 7-day lifecycle rule
so audio clips don't linger forever. If `AWS_S3_BUCKET` is set we respect
that and skip the provisioning dance.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any

import requests

from . import aws_probe
from .config import get_settings

_bucket: str | None = None
_bucket_lock = threading.Lock()

AUDIO_PREFIX = "audio/"
MAX_WAIT_S = 60.0
POLL_INTERVAL_S = 0.6


def _clients():
    import boto3

    s = get_settings()
    kwargs: dict[str, Any] = {"region_name": s.aws_region or s.aws_default_region}
    if s.aws_access_key_id and s.aws_secret_access_key:
        kwargs["aws_access_key_id"] = s.aws_access_key_id
        kwargs["aws_secret_access_key"] = s.aws_secret_access_key
        if s.aws_session_token:
            kwargs["aws_session_token"] = s.aws_session_token
    return boto3.client("s3", **kwargs), boto3.client("transcribe", **kwargs)


def _ensure_bucket() -> str:
    global _bucket
    if _bucket:
        return _bucket
    with _bucket_lock:
        if _bucket:
            return _bucket
        s = get_settings()
        if s.aws_s3_bucket:
            _bucket = s.aws_s3_bucket.strip()
            return _bucket

        from botocore.exceptions import ClientError

        account = (aws_probe.probe().get("identity") or {}).get("account") or "acct"
        region = s.aws_region or s.aws_default_region or "us-east-1"
        name = f"teller-audio-{account}-{region}"

        s3, _ = _clients()
        try:
            s3.head_bucket(Bucket=name)
            _bucket = name
            return _bucket
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code not in ("404", "NoSuchBucket", "NotFound"):
                raise

        # Create it. us-east-1 uniquely rejects LocationConstraint.
        create_kwargs: dict[str, Any] = {"Bucket": name}
        if region != "us-east-1":
            create_kwargs["CreateBucketConfiguration"] = {"LocationConstraint": region}
        s3.create_bucket(**create_kwargs)

        # Auto-expire old audio after a week so we don't accumulate.
        try:
            s3.put_bucket_lifecycle_configuration(
                Bucket=name,
                LifecycleConfiguration={
                    "Rules": [
                        {
                            "ID": "expire-audio",
                            "Status": "Enabled",
                            "Filter": {"Prefix": AUDIO_PREFIX},
                            "Expiration": {"Days": 7},
                        }
                    ]
                },
            )
        except ClientError:
            # Lifecycle perms are best-effort; proceed without them.
            pass

        _bucket = name
        return _bucket


def transcribe_audio(audio_bytes: bytes, media_format: str = "webm") -> dict[str, Any]:
    """Upload audio → start Transcribe job → poll until done → return transcript.

    Returns {"text": str, "language": str|None, "confidence": float|None,
             "duration_s": float|None, "job_name": str}.
    Raises `RuntimeError` on job failure, `TimeoutError` if it doesn't
    finish inside MAX_WAIT_S.
    """
    s3, transcribe = _clients()
    bucket = _ensure_bucket()

    key = f"{AUDIO_PREFIX}{uuid.uuid4()}.{media_format}"
    s3.put_object(Bucket=bucket, Key=key, Body=audio_bytes, ContentType=_content_type(media_format))

    job_name = f"teller-{uuid.uuid4().hex[:16]}"
    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        Media={"MediaFileUri": f"s3://{bucket}/{key}"},
        MediaFormat=media_format,
        IdentifyLanguage=True,
    )

    deadline = time.time() + MAX_WAIT_S
    while time.time() < deadline:
        resp = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        job = resp["TranscriptionJob"]
        status = job["TranscriptionJobStatus"]
        if status == "COMPLETED":
            uri = job["Transcript"]["TranscriptFileUri"]
            data = requests.get(uri, timeout=15).json()
            transcripts = data.get("results", {}).get("transcripts", [])
            text = transcripts[0].get("transcript", "") if transcripts else ""
            return {
                "text": text.strip(),
                "language": job.get("LanguageCode"),
                "confidence": _avg_confidence(data),
                "duration_s": _duration(data),
                "job_name": job_name,
            }
        if status == "FAILED":
            raise RuntimeError(job.get("FailureReason", "transcription failed"))
        time.sleep(POLL_INTERVAL_S)
    raise TimeoutError(f"transcription did not finish in {MAX_WAIT_S:.0f}s")


def _content_type(fmt: str) -> str:
    return {
        "webm": "audio/webm",
        "ogg": "audio/ogg",
        "mp4": "audio/mp4",
        "m4a": "audio/mp4",
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "flac": "audio/flac",
    }.get(fmt, "application/octet-stream")


def _avg_confidence(data: dict) -> float | None:
    items = data.get("results", {}).get("items", [])
    scores: list[float] = []
    for it in items:
        for alt in it.get("alternatives", []) or []:
            try:
                scores.append(float(alt.get("confidence") or 0))
            except (TypeError, ValueError):
                continue
    return round(sum(scores) / len(scores), 3) if scores else None


def _duration(data: dict) -> float | None:
    items = data.get("results", {}).get("items", [])
    ends = []
    for it in items:
        try:
            ends.append(float(it.get("end_time") or 0))
        except (TypeError, ValueError):
            continue
    return round(max(ends), 2) if ends else None
