"""
Configuração central do sidecar Semantica.
"""

import os
from typing import Optional
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseModel):
    """Configurações via env vars."""

    # ── Server ─────────────────────────────────────────────────────
    app_name: str = "Zélla Semantica Sidecar"
    version: str = "1.0.0"
    host: str = os.getenv("SEMANTICA_HOST", "127.0.0.1")
    port: int = int(os.getenv("SEMANTICA_PORT", "7432"))
    workers: int = int(os.getenv("SEMANTICA_WORKERS", "2"))
    reload: bool = os.getenv("SEMANTICA_RELOAD", "false").lower() == "true"

    # ── Auth ───────────────────────────────────────────────────────
    api_key: str = os.getenv("SEMANTICA_API_KEY", "")
    require_auth: bool = os.getenv("SEMANTICA_REQUIRE_AUTH", "true").lower() == "true"

    # ── mTLS ───────────────────────────────────────────────────────
    mtls_enabled: bool = os.getenv("SEMANTICA_MTLS_ENABLED", "false").lower() == "true"
    mtls_cert_path: Optional[str] = os.getenv("SEMANTICA_MTLS_CERT_PATH")
    mtls_key_path: Optional[str] = os.getenv("SEMANTICA_MTLS_KEY_PATH")
    mtls_ca_path: Optional[str] = os.getenv("SEMANTICA_MTLS_CA_PATH")

    # ── Postgres ───────────────────────────────────────────────────
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://seuzella:seuzella@localhost:5432/seuzella_prod"
    )
    semantica_schema: str = os.getenv("SEMANTICA_SCHEMA", "semantica")

    # ── Rate Limiting ──────────────────────────────────────────────
    rate_limit_per_minute: int = int(os.getenv("SEMANTICA_RATE_LIMIT", "100"))

    # ── Cache (Redis opcional) ────────────────────────────────────
    redis_url: str = os.getenv("REDIS_URL", "")
    cache_ttl_sec: int = int(os.getenv("SEMANTICA_CACHE_TTL", "300"))

    # ── Semantica config ───────────────────────────────────────────
    semantica_config_path: str = os.getenv(
        "SEMANTICA_CONFIG_PATH",
        os.path.expanduser("~/.semantica/config.yaml")
    )

    # ── Observabilidade ────────────────────────────────────────────
    sentry_dsn: str = os.getenv("SENTRY_DSN", "")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    # ── Mode ───────────────────────────────────────────────────────
    mock_mode: bool = os.getenv("SEMANTICA_MOCK_MODE", "true").lower() == "true"
    """Mock mode: usa dados sintéticos, não chama LLM nem Postgres real.
    Útil para dev sem VPS. Em prod: SEMANTICA_MOCK_MODE=false."""


settings = Settings()


def is_production() -> bool:
    return os.getenv("NODE_ENV") == "production" or os.getenv("ENVIRONMENT") == "production"
