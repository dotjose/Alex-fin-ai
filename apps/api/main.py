"""FastAPI application entry."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from datetime import datetime, timezone

from pathlib import Path

from dotenv import load_dotenv

# Load env before Settings: OS env wins; then `.env`; then `.env.local` overrides file values.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_env = _REPO_ROOT / ".env"
_env_local = _REPO_ROOT / ".env.local"
load_dotenv(_env, override=False)
load_dotenv(_env_local, override=True)

from pydantic import ValidationError
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from core.config import apply_settings_to_environ, get_settings
from routes import register_routes
from services.startup_checks import log_startup_connectivity
from src import run_pending_migrations, warn_if_core_tables_missing


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_IS_LAMBDA = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME") or os.environ.get("LAMBDA_TASK_ROOT"))
_LOGGED_ENV_KEYS = (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENROUTER_API_KEY",
    "CLERK_JWT_ISSUER",
)


def log_required_env_gaps() -> list[str]:
    """Log presence of critical env vars (never values). Safe before Settings validation."""
    missing = [k for k in _LOGGED_ENV_KEYS if not (os.environ.get(k) or "").strip()]
    if missing:
        logger.warning("startup_env_missing_keys=%s (values are not logged)", missing)
    return missing


def _health_payload() -> dict[str, str]:
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def create_app() -> FastAPI:
    log_required_env_gaps()

    app = FastAPI(
        title="AlexFin.ai API",
        description="Backend API for portfolio intelligence and analysis",
        version="2.0.0",
    )

    @app.get("/health")
    async def health_check():
        """No DB, auth, or external I/O."""
        return _health_payload()

    @app.get("/api/health")
    async def health_check_api_prefix():
        """Same as /health; matches API Gateway ANY /api/{proxy+} and CloudFront /api/*."""
        return _health_payload()

    try:
        settings = get_settings()
    except ValidationError as e:
        logger.critical(
            "Invalid or incomplete configuration. Compare repository root `.env` to `.env.example`. "
            "If you see SUPABASE_DATABASE_URL missing: add the Postgres URI from "
            "Supabase → Project Settings → Database (not the https://… REST URL)."
        )
        for err in e.errors():
            loc = ".".join(str(x) for x in err.get("loc", ()))
            logger.critical("  %s: %s", loc or "settings", err.get("msg"))
        if _IS_LAMBDA:
            logger.error(
                "Lambda: invalid settings — serving only /health and /api/health until env is fixed."
            )
            return _attach_minimal_handlers(app)
        raise SystemExit(1) from e

    apply_settings_to_environ()

    _db_startup_lock = threading.Lock()
    app.state.db_startup_complete = False

    def _run_db_startup() -> None:
        logger.info("Running database migrations (Postgres)")
        run_pending_migrations(settings.supabase_database_url)
        logger.info("Database migrations complete")
        warn_if_core_tables_missing(settings.supabase_database_url)
        log_startup_connectivity(settings)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def api_request_observability(request: Request, call_next):
        if not request.url.path.startswith("/api"):
            return await call_next(request)
        t0 = time.perf_counter()
        cl = request.headers.get("content-length")
        trace_hdr = request.headers.get("x-trace-id") or request.headers.get(
            "X-Amzn-Trace-Id"
        )
        auth_present = bool(request.headers.get("authorization"))
        try:
            response = await call_next(request)
            ms = round((time.perf_counter() - t0) * 1000.0, 2)
            logger.info(
                json.dumps(
                    {
                        "event": "api_http_request",
                        "endpoint": request.url.path,
                        "method": request.method,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "duration_ms": ms,
                        "status_code": response.status_code,
                        "payload_size": int(cl) if cl and cl.isdigit() else cl,
                        "trace_header": trace_hdr,
                        "authorization_present": auth_present,
                    },
                    default=str,
                )
            )
            return response
        except Exception:
            ms = round((time.perf_counter() - t0) * 1000.0, 2)
            logger.info(
                json.dumps(
                    {
                        "event": "api_http_request_error",
                        "endpoint": request.url.path,
                        "method": request.method,
                        "duration_ms": ms,
                        "trace_header": trace_hdr,
                    },
                    default=str,
                )
            )
            raise

    @app.middleware("http")
    async def deferred_db_startup(request: Request, call_next):
        path = request.url.path
        if path in ("/health", "/api/health"):
            return await call_next(request)

        def _sync_once() -> None:
            with _db_startup_lock:
                if app.state.db_startup_complete:
                    return
                _run_db_startup()
                app.state.db_startup_complete = True

        await asyncio.to_thread(_sync_once)
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Invalid request.",
                "errors": exc.errors(),
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        user_friendly = {
            401: "Your session has expired. Please sign in again.",
            403: "You don't have permission to access this resource.",
            404: "The requested resource was not found.",
            429: "Too many requests. Please slow down and try again later.",
            500: "An internal error occurred. Please try again later.",
            503: "The service is temporarily unavailable. Please try again later.",
        }
        message = user_friendly.get(exc.status_code, exc.detail)
        return JSONResponse(status_code=exc.status_code, content={"detail": message})

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error("Unexpected error: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected error occurred. Our team has been notified."},
        )

    register_routes(app, settings)
    return app


def _attach_minimal_handlers(app: FastAPI) -> FastAPI:
    """Exception handlers when Settings cannot load (Lambda degraded mode)."""

    @app.exception_handler(RequestValidationError)
    async def request_validation_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Invalid request.",
                "errors": exc.errors(),
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error("Unexpected error: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected error occurred. Our team has been notified."},
        )

    return app


app = create_app()
