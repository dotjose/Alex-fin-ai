"""FastAPI application entry."""

from __future__ import annotations

import json
import logging
import time
from contextlib import asynccontextmanager
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


@asynccontextmanager
async def lifespan(_: FastAPI):
    apply_settings_to_environ()
    yield


def create_app() -> FastAPI:
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
        raise SystemExit(1) from e
    apply_settings_to_environ()
    logger.info("Running database migrations (Postgres)")
    run_pending_migrations(settings.supabase_database_url)
    logger.info("Database migrations complete")
    warn_if_core_tables_missing(settings.supabase_database_url)
    log_startup_connectivity(settings)

    app = FastAPI(
        title="AlexFin.ai API",
        description="Backend API for portfolio intelligence and analysis",
        version="2.0.0",
        lifespan=lifespan,
    )

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

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "timestamp": datetime.now().isoformat()}

    register_routes(app, settings)
    return app


app = create_app()
