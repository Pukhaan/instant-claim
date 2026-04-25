"""
Voice → text via AWS Transcribe.

Two paths:

1. **Streaming** (default): ffmpeg transcodes the uploaded webm/opus blob to
   16 kHz mono PCM in-process, then we open an HTTP/2 streaming connection
   to AWS Transcribe Streaming and feed the PCM in chunks. End-to-end on a
   5–10 s clip: ~1.5–3 s. Requires `ffmpeg` in the runtime image and the
   `amazon-transcribe` SDK.

2. **Batch fallback**: stash audio in S3 → start_transcription_job → poll.
   ~4–8 s. Used automatically if streaming fails (missing ffmpeg, SDK error,
   container mismatch). The S3 bucket is auto-provisioned with a 7-day
   lifecycle rule so clips don't linger.

The public entry point `transcribe_audio()` tries streaming first, falls
back to batch on any error, and returns the same dict shape either way so
callers don't care which path ran.
"""

from __future__ import annotations

import asyncio
import logging
import subprocess
import threading
import time
import uuid
from typing import Any

import requests

from . import aws_probe
from .config import get_settings

log = logging.getLogger(__name__)

_bucket: str | None = None
_bucket_lock = threading.Lock()

AUDIO_PREFIX = "audio/"
MAX_WAIT_S = 45.0
# Aggressive polling so end-to-end latency on a 5-10s clip is closer to 4-6s.
# AWS Transcribe doesn't charge per get_transcription_job poll.
POLL_INTERVAL_INITIAL_S = 0.25
POLL_INTERVAL_MAX_S = 1.0
DEFAULT_LANGUAGE = "en-US"


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


def transcribe_audio(
    audio_bytes: bytes,
    media_format: str = "webm",
    language_code: str = DEFAULT_LANGUAGE,
) -> dict[str, Any]:
    """Try AWS Transcribe **Streaming** first; fall back to batch on error.

    Returns {"text": str, "language": str|None, "confidence": float|None,
             "duration_s": float|None, "job_name": str|None, "path": "streaming"|"batch"}.
    """
    started = time.time()
    try:
        result = _transcribe_streaming(audio_bytes, media_format, language_code)
        result["path"] = "streaming"
        result["wall_time_s"] = round(time.time() - started, 2)
        return result
    except Exception as exc:  # noqa: BLE001 — broad catch is the whole point
        log.warning("streaming transcribe failed (%s); falling back to batch", exc)
    result = _transcribe_batch(audio_bytes, media_format, language_code)
    result["path"] = "batch"
    result["wall_time_s"] = round(time.time() - started, 2)
    return result


# --------------------------------------------------------------------------
# Streaming path — ffmpeg → PCM → AWS Transcribe Streaming SDK
# --------------------------------------------------------------------------


def _transcribe_streaming(
    audio_bytes: bytes,
    media_format: str,
    language_code: str,
) -> dict[str, Any]:
    """Transcode in-process to PCM and stream to Transcribe Streaming."""
    pcm = _ffmpeg_to_pcm16(audio_bytes, source_format=media_format, sample_rate=16000)
    text = asyncio.run(_run_streaming(pcm, language_code=language_code, sample_rate=16000))
    return {
        "text": text.strip(),
        "language": language_code,
        "confidence": None,
        "duration_s": round(len(pcm) / (16000 * 2), 2),  # 16-bit mono → 2 bytes/sample
        "job_name": None,
    }


def _ffmpeg_to_pcm16(audio_bytes: bytes, source_format: str, sample_rate: int) -> bytes:
    """Pipe `audio_bytes` through ffmpeg, return raw 16-bit little-endian mono PCM.

    Uses `pipe:0`/`pipe:1` so we never touch disk. Forces mono + the desired
    sample rate (AWS Transcribe Streaming wants 8000–48000 Hz).
    """
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-f",
        "s16le",
        "pipe:1",
    ]
    proc = subprocess.run(  # noqa: S603 — controlled args, audio data on stdin
        cmd,
        input=audio_bytes,
        capture_output=True,
        timeout=15,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed (rc={proc.returncode}, fmt={source_format}): "
            f"{proc.stderr.decode('utf-8', errors='replace')[:400]}"
        )
    if not proc.stdout:
        raise RuntimeError("ffmpeg produced no PCM output")
    return proc.stdout


async def _run_streaming(pcm: bytes, language_code: str, sample_rate: int) -> str:
    """Open an AWS Transcribe Streaming session, feed PCM chunks, gather text."""
    # Lazy-imported so the batch path still works if the SDK is missing.
    import os

    from amazon_transcribe.client import TranscribeStreamingClient
    from amazon_transcribe.handlers import TranscriptResultStreamHandler
    from amazon_transcribe.model import TranscriptEvent

    settings = get_settings()
    region = settings.aws_region or settings.aws_default_region or "us-east-1"

    # The amazon-transcribe SDK uses awscrt's default credential resolver, which
    # only reads from os.environ + ~/.aws + IMDS. Our settings come from a
    # Pydantic-loaded .env that doesn't touch os.environ, so mirror them here.
    if settings.aws_access_key_id and not os.environ.get("AWS_ACCESS_KEY_ID"):
        os.environ["AWS_ACCESS_KEY_ID"] = settings.aws_access_key_id
    if settings.aws_secret_access_key and not os.environ.get("AWS_SECRET_ACCESS_KEY"):
        os.environ["AWS_SECRET_ACCESS_KEY"] = settings.aws_secret_access_key
    if settings.aws_session_token and not os.environ.get("AWS_SESSION_TOKEN"):
        os.environ["AWS_SESSION_TOKEN"] = settings.aws_session_token
    if region and not os.environ.get("AWS_REGION"):
        os.environ["AWS_REGION"] = region

    client = TranscribeStreamingClient(region=region)

    stream = await client.start_stream_transcription(
        language_code=language_code,
        media_sample_rate_hz=sample_rate,
        media_encoding="pcm",
    )

    finals: list[str] = []

    class _Handler(TranscriptResultStreamHandler):
        async def handle_transcript_event(self, transcript_event: TranscriptEvent) -> None:
            for result in transcript_event.transcript.results:
                if result.is_partial:
                    continue
                for alt in result.alternatives or []:
                    if alt.transcript:
                        finals.append(alt.transcript)

    handler = _Handler(stream.output_stream)

    async def _writer() -> None:
        # 8 KB chunks — keeps the request stream lively without saturating it.
        chunk = 8 * 1024
        for i in range(0, len(pcm), chunk):
            await stream.input_stream.send_audio_event(audio_chunk=pcm[i : i + chunk])
        await stream.input_stream.end_stream()

    await asyncio.gather(_writer(), handler.handle_events())
    return " ".join(finals)


# --------------------------------------------------------------------------
# Batch path — kept as a fallback
# --------------------------------------------------------------------------


def _transcribe_batch(
    audio_bytes: bytes,
    media_format: str,
    language_code: str,
) -> dict[str, Any]:
    s3, transcribe = _clients()
    bucket = _ensure_bucket()

    key = f"{AUDIO_PREFIX}{uuid.uuid4()}.{media_format}"
    s3.put_object(Bucket=bucket, Key=key, Body=audio_bytes, ContentType=_content_type(media_format))

    job_name = f"teller-{uuid.uuid4().hex[:16]}"
    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        Media={"MediaFileUri": f"s3://{bucket}/{key}"},
        MediaFormat=media_format,
        LanguageCode=language_code,
    )

    deadline = time.time() + MAX_WAIT_S
    interval = POLL_INTERVAL_INITIAL_S
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
                "language": job.get("LanguageCode") or language_code,
                "confidence": _avg_confidence(data),
                "duration_s": _duration(data),
                "job_name": job_name,
            }
        if status == "FAILED":
            raise RuntimeError(job.get("FailureReason", "transcription failed"))
        time.sleep(interval)
        # Slow polls down a bit so we don't hammer Transcribe for a long-running job.
        interval = min(POLL_INTERVAL_MAX_S, interval * 1.4)
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
