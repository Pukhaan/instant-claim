"""Teller FastAPI entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import aws_probe, bunq_service
from .config import get_settings
from .routes import chat as chat_routes
from .routes import claim as claim_routes
from .routes import receipt as receipt_routes
from .routes import voice as voice_routes


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        bunq_service.get_client()
        print("[teller] bunq client authenticated")
    except Exception as exc:
        print(f"[teller] bunq client bootstrap deferred: {exc!r}")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Teller API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict:
        try:
            me = bunq_service.whoami()
            accounts = bunq_service.list_accounts()
            aws = aws_probe.probe()
            aws_services = {k: bool(v.get("ok")) for k, v in (aws.get("services") or {}).items()}
            return {
                "ok": True,
                "bunq": {"user": me, "accounts_count": len(accounts)},
                "anthropic_configured": bool(settings.anthropic_api_key),
                "aws_configured": bool(aws.get("has_credentials")),
                "aws_region": aws.get("region"),
                "aws_identity": aws.get("identity"),
                "aws_services": aws_services,
            }
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"bunq unavailable: {exc!r}") from exc

    @app.get("/aws/probe")
    def aws_probe_route(force: bool = False) -> dict:
        return aws_probe.probe(force=force)

    @app.get("/accounts")
    def accounts() -> list[dict]:
        return bunq_service.list_accounts()

    @app.get("/accounts/{account_id}/transactions")
    def transactions(account_id: int, count: int = 20) -> list[dict]:
        return bunq_service.list_transactions(account_id, count=count)

    @app.post("/sandbox/topup")
    def sandbox_topup(amount_eur: float = 500.0) -> dict:
        if not settings.bunq_sandbox:
            raise HTTPException(400, "sandbox-only endpoint")
        return bunq_service.request_sandbox_money(amount_eur)

    app.include_router(chat_routes.router)
    app.include_router(receipt_routes.router)
    app.include_router(voice_routes.router)
    app.include_router(claim_routes.router)

    return app


app = create_app()
