"""AWS Lambda handler — ASGI via Mangum (FastAPI)."""

import logging
import os

from mangum import Mangum

logger = logging.getLogger(__name__)

_LAMBDA_ENV_KEYS = (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENROUTER_API_KEY",
    "CLERK_JWT_ISSUER",
)


def _log_missing_lambda_env() -> None:
    if not (os.environ.get("AWS_LAMBDA_FUNCTION_NAME") or os.environ.get("LAMBDA_TASK_ROOT")):
        return
    missing = [k for k in _LAMBDA_ENV_KEYS if not (os.environ.get(k) or "").strip()]
    if missing:
        logger.warning("lambda_handler_missing_env_keys=%s (values are not logged)", missing)


_log_missing_lambda_env()

from main import app  # noqa: E402  # import after env logging

handler = Mangum(app)
