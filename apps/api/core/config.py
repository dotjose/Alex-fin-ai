"""Strict typed configuration — fail fast at import / lifespan."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[3]
_ENV_FILE_PATHS = tuple(
    str(p)
    for p in (_REPO_ROOT / ".env", _REPO_ROOT / ".env.local")
    if p.is_file()
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE_PATHS if _ENV_FILE_PATHS else str(_REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    node_env: Literal["development", "production"] = Field(alias="NODE_ENV")
    api_base_url: str = Field(alias="API_BASE_URL")
    frontend_url: str = Field(alias="FRONTEND_URL")

    clerk_jwt_issuer: str = Field(alias="CLERK_JWT_ISSUER")
    clerk_jwt_audience: str | None = Field(default=None, alias="CLERK_JWT_AUDIENCE")

    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_database_url: str = Field(alias="SUPABASE_DATABASE_URL")

    openrouter_api_key: str = Field(alias="OPENROUTER_API_KEY")
    openrouter_app_name: str = Field(default="alex-finance")
    or_model_simple: str = Field(alias="OR_MODEL_SIMPLE")
    or_model_reasoning: str = Field(alias="OR_MODEL_REASONING")
    or_model_fast: str = Field(alias="OR_MODEL_FAST")
    or_model_embedding: str | None = Field(default=None, alias="OR_MODEL_EMBEDDING")

    langfuse_public_key: str | None = Field(default=None, alias="LANGFUSE_PUBLIC_KEY")
    langfuse_secret_key: str | None = Field(default=None, alias="LANGFUSE_SECRET_KEY")
    langfuse_host: str | None = Field(default=None, alias="LANGFUSE_HOST")

    polygon_api_key: str = Field(alias="POLYGON_API_KEY")
    polygon_plan: str = Field(default="free", alias="POLYGON_PLAN")

    aws_region: str = Field(default="us-east-1", alias="AWS_REGION")
    aws_access_key_id: str | None = Field(default=None, alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(default=None, alias="AWS_SECRET_ACCESS_KEY")
    aws_session_token: str | None = Field(default=None, alias="AWS_SESSION_TOKEN")
    aws_profile: str | None = Field(default=None, alias="AWS_PROFILE")
    sqs_queue_url: str | None = Field(default=None, alias="SQS_QUEUE_URL")
    s3_bucket_ui: str | None = Field(default=None, alias="S3_BUCKET_UI")
    # Local / staging: run planner worker in-process after POST /api/analyze (no SQS).
    mock_lambdas: bool = Field(default=False, alias="MOCK_LAMBDAS")
    # Explicit local flag (works with NODE_ENV=production in containers without SQS).
    local_dev: bool = Field(default=False, alias="LOCAL_DEV")
    # Child agents: ``local`` runs packaged ``lambda_handler`` in-process; ``lambda`` uses boto3 invoke.
    agent_execution_mode: Literal["local", "lambda"] = Field(default="local", alias="AGENT_EXECUTION_MODE")

    @property
    def clerk_jwks_url(self) -> str:
        base = self.clerk_jwt_issuer.rstrip("/")
        return f"{base}/.well-known/jwks.json"

    def cors_allow_origins(self) -> list[str]:
        origins = [self.frontend_url.rstrip("/"), self.api_base_url.rstrip("/")]
        if self.node_env == "development":
            origins.append("http://localhost:3000")
        return list(dict.fromkeys(origins))

    @field_validator(
        "supabase_url",
        "supabase_service_role_key",
        "supabase_database_url",
        mode="before",
    )
    @classmethod
    def strip_supabase_strings(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("supabase_url", mode="after")
    @classmethod
    def validate_supabase_rest_url(cls, v: str) -> str:
        raw = (v or "").strip().rstrip("/")
        if raw.lower().startswith(("postgres://", "postgresql://")):
            raise ValueError(
                "SUPABASE_URL must be the HTTPS REST base URL (https://<ref>.supabase.co), "
                "not a postgres:// connection string. Use SUPABASE_DATABASE_URL for Postgres."
            )
        parsed = urlparse(raw)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("SUPABASE_URL must use http or https.")
        if parsed.scheme == "http":
            host = (parsed.hostname or "").lower()
            if host not in ("127.0.0.1", "localhost"):
                raise ValueError(
                    "SUPABASE_URL may use http only for local Supabase (127.0.0.1 / localhost)."
                )
            return raw
        host = (parsed.hostname or "").lower()
        if not host.endswith(".supabase.co"):
            raise ValueError(
                "SUPABASE_URL must be https://<project-ref>.supabase.co (Supabase REST API)."
            )
        return raw

    @field_validator("supabase_database_url", mode="after")
    @classmethod
    def validate_supabase_database_url(cls, v: str) -> str:
        raw = (v or "").strip()
        if not raw.lower().startswith(("postgres://", "postgresql://")):
            raise ValueError(
                "SUPABASE_DATABASE_URL must be a PostgreSQL URI (postgresql://... or postgres://...). "
                "Find it under Supabase → Project Settings → Database."
            )
        return raw

    @model_validator(mode="after")
    def supabase_must_be_configured(self) -> Settings:
        lp = (self.langfuse_public_key or "").strip()
        ls = (self.langfuse_secret_key or "").strip()
        if bool(lp) != bool(ls):
            raise ValueError(
                "Set both LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY for tracing, "
                "or omit both for a no-op observability path."
            )
        if lp and ls:
            self.langfuse_public_key = lp
            self.langfuse_secret_key = ls
            if not (self.langfuse_host or "").strip():
                self.langfuse_host = "https://cloud.langfuse.com"
        else:
            self.langfuse_public_key = None
            self.langfuse_secret_key = None
            self.langfuse_host = None

        if not self.supabase_url or not self.supabase_service_role_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to non-empty "
                f"values in {_REPO_ROOT / '.env'} (repository root). "
                "Copy from Supabase → Project Settings → API (URL + service_role secret)."
            )
        if not (self.supabase_database_url or "").strip():
            raise ValueError(
                "SUPABASE_DATABASE_URL is required for schema migrations at startup. "
                "Use the Database connection URI from Supabase (not the REST URL)."
            )
        if (self.sqs_queue_url or "").strip() and not self.mock_lambdas:
            self._validate_aws_when_sqs_configured()
        return self

    def _validate_aws_when_sqs_configured(self) -> None:
        """Resolve credentials with boto3 when SQS is configured; fail fast if missing."""
        from services.aws import validate_boto_credentials_when_sqs_configured

        validate_boto_credentials_when_sqs_configured(self)

    @field_validator("mock_lambdas", "local_dev", mode="before")
    @classmethod
    def coerce_bool_flags(cls, v: object) -> bool:
        if isinstance(v, str):
            return v.strip().lower() in ("1", "true", "yes", "on")
        return bool(v)

    @field_validator(
        "langfuse_public_key",
        "langfuse_secret_key",
        "langfuse_host",
        "sqs_queue_url",
        "s3_bucket_ui",
        "aws_access_key_id",
        "aws_secret_access_key",
        "aws_session_token",
        "aws_profile",
        mode="before",
    )
    @classmethod
    def empty_optional_str_to_none(cls, v: object) -> object:
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @field_validator("aws_region", mode="after")
    @classmethod
    def aws_region_required(cls, v: str) -> str:
        raw = (v or "").strip()
        if not raw:
            raise ValueError(
                "AWS_REGION must be set to a non-empty value (e.g. us-east-1) for boto3 clients."
            )
        return raw

@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


def apply_settings_to_environ() -> None:
    """Sync validated settings into os.environ for libraries that read env directly."""
    import os

    s = get_settings()
    os.environ.setdefault("NODE_ENV", s.node_env)
    os.environ["SUPABASE_URL"] = s.supabase_url
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = s.supabase_service_role_key
    os.environ["SUPABASE_DATABASE_URL"] = s.supabase_database_url
    os.environ["OPENROUTER_API_KEY"] = s.openrouter_api_key
    os.environ.setdefault("OPENROUTER_APP_NAME", s.openrouter_app_name)
    os.environ["OR_MODEL_SIMPLE"] = s.or_model_simple
    os.environ["OR_MODEL_REASONING"] = s.or_model_reasoning
    os.environ["OR_MODEL_FAST"] = s.or_model_fast
    if s.or_model_embedding:
        os.environ["OR_MODEL_EMBEDDING"] = s.or_model_embedding
    if (s.langfuse_public_key or "").strip() and (s.langfuse_secret_key or "").strip():
        os.environ["LANGFUSE_PUBLIC_KEY"] = s.langfuse_public_key.strip()  # type: ignore[union-attr]
        os.environ["LANGFUSE_SECRET_KEY"] = s.langfuse_secret_key.strip()  # type: ignore[union-attr]
        host = (s.langfuse_host or "https://cloud.langfuse.com").strip().rstrip("/")
        os.environ["LANGFUSE_HOST"] = host
    else:
        os.environ.pop("LANGFUSE_PUBLIC_KEY", None)
        os.environ.pop("LANGFUSE_SECRET_KEY", None)
        os.environ.pop("LANGFUSE_HOST", None)
    os.environ["POLYGON_API_KEY"] = s.polygon_api_key
    os.environ["POLYGON_PLAN"] = s.polygon_plan
    os.environ["AWS_DEFAULT_REGION"] = s.aws_region
    os.environ.setdefault("DEFAULT_AWS_REGION", s.aws_region)
    os.environ["AWS_REGION"] = s.aws_region
    # LiteLLM reads AWS_REGION_NAME for several providers; keep identical to AWS_REGION (OpenRouter stack).
    os.environ["AWS_REGION_NAME"] = s.aws_region
    os.environ.pop("BEDROCK_REGION", None)
    if s.aws_profile:
        os.environ["AWS_PROFILE"] = s.aws_profile.strip()
    if s.mock_lambdas:
        os.environ["MOCK_LAMBDAS"] = "1"
    else:
        os.environ.pop("MOCK_LAMBDAS", None)
    if s.local_dev:
        os.environ["LOCAL_DEV"] = "true"
    else:
        os.environ.pop("LOCAL_DEV", None)
    os.environ["AGENT_EXECUTION_MODE"] = s.agent_execution_mode
    os.environ["CLERK_JWT_ISSUER"] = s.clerk_jwt_issuer.strip()
    if (s.clerk_jwt_audience or "").strip():
        os.environ["CLERK_JWT_AUDIENCE"] = (s.clerk_jwt_audience or "").strip()
    else:
        os.environ.pop("CLERK_JWT_AUDIENCE", None)
    os.environ.setdefault("OTEL_SERVICE_NAME", "alexfin-agent")
    os.environ.setdefault("LANGFUSE_TRACING_ENVIRONMENT", s.node_env)
    # OpenAI Agents default trace export targets OpenAI; we use Langfuse + OpenRouter only.
    os.environ.setdefault("OPENAI_AGENTS_DISABLE_TRACING", "true")
