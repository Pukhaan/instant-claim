# syntax=docker/dockerfile:1.7
FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    STATE_DIR=/app/state

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY app ./app

RUN mkdir -p /app/state

EXPOSE 8080

# Use a non-root user so the volume is owned correctly on Fly.
RUN useradd --create-home --shell /bin/bash teller \
  && chown -R teller:teller /app
USER teller

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
