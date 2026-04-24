"""
Lightweight bunq API client — auth, request signing, context caching.

Adapted from the official bunq hackathon toolkit (see /hackathon_toolkit/bunq_client.py).
Kept sync on purpose: FastAPI runs sync endpoints in a threadpool, and the bunq
sandbox rate limits (3 GET/3s, 5 POST/3s) make async orchestration unnecessary.
"""

from __future__ import annotations

import base64
import json
import os
import uuid
from pathlib import Path

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

SANDBOX_BASE_URL = "https://public-api.sandbox.bunq.com"
PRODUCTION_BASE_URL = "https://api.bunq.com"
API_VERSION = "v1"
DEFAULT_CONTEXT_FILE = "bunq_context.json"
USER_AGENT = "teller-hackathon/0.1"


class BunqClient:
    def __init__(
        self,
        api_key: str,
        sandbox: bool = True,
        context_file: str | Path = DEFAULT_CONTEXT_FILE,
    ) -> None:
        self.api_key = api_key
        self.sandbox = sandbox
        self.base_url = SANDBOX_BASE_URL if sandbox else PRODUCTION_BASE_URL
        self.context_file = Path(context_file)

        self.installation_token: str | None = None
        self.server_public_key: str | None = None
        self.session_token: str | None = None
        self.user_id: int | None = None

        self._private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self._public_key_pem = self._serialize_public_key(self._private_key)

    @staticmethod
    def _serialize_public_key(private_key) -> str:
        return private_key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()

    @staticmethod
    def create_sandbox_user() -> str:
        """Creates a throwaway sandbox user and returns the API key."""
        resp = requests.post(
            f"{SANDBOX_BASE_URL}/{API_VERSION}/sandbox-user-person",
            headers=_base_headers(),
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()["Response"][0]["ApiKey"]["api_key"]

    def authenticate(self) -> None:
        if self._load_context() and self._test_session():
            return
        self._step_installation()
        self._step_device_server()
        self._step_session_server()
        self._save_context()

    def _step_installation(self) -> None:
        resp = self._raw_post("installation", {"client_public_key": self._public_key_pem}, auth_token=None)
        for item in resp:
            if "Token" in item:
                self.installation_token = item["Token"]["token"]
            if "ServerPublicKey" in item:
                self.server_public_key = item["ServerPublicKey"]["server_public_key"]

    def _step_device_server(self) -> None:
        self._raw_post(
            "device-server",
            {"description": USER_AGENT, "secret": self.api_key, "permitted_ips": ["*"]},
            auth_token=self.installation_token,
        )

    def _step_session_server(self) -> None:
        resp = self._raw_post("session-server", {"secret": self.api_key}, auth_token=self.installation_token)
        for item in resp:
            if "Token" in item:
                self.session_token = item["Token"]["token"]
            for user_key in ("UserPerson", "UserCompany", "UserApiKey"):
                if user_key in item:
                    self.user_id = item[user_key]["id"]

    def _test_session(self) -> bool:
        try:
            self.get(f"user/{self.user_id}")
            return True
        except requests.HTTPError:
            return False

    def get(self, endpoint: str, params: dict | None = None) -> list:
        return self._request("GET", endpoint, params=params)

    def post(self, endpoint: str, body: dict) -> list:
        return self._request("POST", endpoint, body=body)

    def put(self, endpoint: str, body: dict) -> list:
        return self._request("PUT", endpoint, body=body)

    def delete(self, endpoint: str) -> list:
        return self._request("DELETE", endpoint)

    def get_primary_account_id(self) -> int:
        resp = self.get(f"user/{self.user_id}/monetary-account-bank")
        for item in resp:
            acc = item.get("MonetaryAccountBank", {})
            if acc.get("status") == "ACTIVE":
                return acc["id"]
        raise RuntimeError("No active monetary account found")

    def _request(
        self,
        method: str,
        endpoint: str,
        body: dict | None = None,
        params: dict | None = None,
    ) -> list:
        url = f"{self.base_url}/{API_VERSION}/{endpoint}"
        headers = self._session_headers(body)
        json_body = body if method in ("POST", "PUT") else None
        resp = requests.request(method, url, headers=headers, json=json_body, params=params, timeout=20)
        resp.raise_for_status()
        return resp.json().get("Response", [])

    def _raw_post(self, endpoint: str, body: dict, auth_token: str | None) -> list:
        url = f"{self.base_url}/{API_VERSION}/{endpoint}"
        headers = _base_headers()
        if auth_token:
            headers["X-Bunq-Client-Authentication"] = auth_token
        body_bytes = json.dumps(body).encode()
        headers["X-Bunq-Client-Signature"] = self._sign(body_bytes)
        resp = requests.post(url, headers=headers, data=body_bytes, timeout=20)
        resp.raise_for_status()
        return resp.json().get("Response", [])

    def _session_headers(self, body: dict | None) -> dict:
        headers = _base_headers()
        if self.session_token:
            headers["X-Bunq-Client-Authentication"] = self.session_token
        if body is not None:
            body_bytes = json.dumps(body).encode()
            headers["X-Bunq-Client-Signature"] = self._sign(body_bytes)
        return headers

    def _sign(self, body_bytes: bytes) -> str:
        signature = self._private_key.sign(body_bytes, padding.PKCS1v15(), hashes.SHA256())
        return base64.b64encode(signature).decode()

    def _save_context(self) -> None:
        context = {
            "api_key": self.api_key,
            "sandbox": self.sandbox,
            "private_key_pem": self._private_key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            ).decode(),
            "installation_token": self.installation_token,
            "server_public_key": self.server_public_key,
            "session_token": self.session_token,
            "user_id": self.user_id,
        }
        self.context_file.write_text(json.dumps(context, indent=2))

    def _load_context(self) -> bool:
        if not self.context_file.exists():
            return False
        try:
            ctx = json.loads(self.context_file.read_text())
            if ctx.get("api_key") != self.api_key or ctx.get("sandbox") != self.sandbox:
                return False
            self._private_key = serialization.load_pem_private_key(
                ctx["private_key_pem"].encode(), password=None
            )
            self._public_key_pem = self._serialize_public_key(self._private_key)
            self.installation_token = ctx["installation_token"]
            self.server_public_key = ctx["server_public_key"]
            self.session_token = ctx["session_token"]
            self.user_id = ctx["user_id"]
            return True
        except (json.JSONDecodeError, KeyError, ValueError, OSError):
            return False


def _base_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "User-Agent": USER_AGENT,
        "X-Bunq-Client-Request-Id": str(uuid.uuid4()),
        "X-Bunq-Language": "en_US",
        "X-Bunq-Region": "nl_NL",
        "X-Bunq-Geolocation": "0 0 0 0 000",
    }
