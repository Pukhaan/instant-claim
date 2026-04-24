"""Runtime configuration loaded from environment / .env."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    bunq_api_key: str = ""
    bunq_sandbox: bool = True

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-5-20250929"

    # Default to Bedrock so the whole stack is AWS-native. Flip to false to
    # fall back to api.anthropic.com (useful when AWS session creds expire).
    use_bedrock: bool = True

    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_session_token: str = ""
    aws_region: str = "us-east-1"
    aws_default_region: str = "us-east-1"
    aws_s3_bucket: str = ""

    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    # Directory for persisted runtime state (bunq context, sandbox key, enrichments).
    # Local default: current working dir. On Fly.io we mount a persistent volume here.
    state_dir: str = "."

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
