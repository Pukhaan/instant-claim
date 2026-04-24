"""Teller FastAPI entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import bunq_service
from .config import get_settings
from .routes import chat as chat_routes


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
            return {
                "ok": True,
                "bunq": {"user": me, "accounts_count": len(accounts)},
                "anthropic_configured": bool(settings.anthropic_api_key),
                "aws_configured": bool(settings.aws_access_key_id and settings.aws_s3_bucket),
            }
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"bunq unavailable: {exc!r}") from exc

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

    return app


app = create_app()
