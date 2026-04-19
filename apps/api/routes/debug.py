"""Debug endpoints (no secrets): env key presence + JWT claim echo."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from core.auth import HTTPAuthorizationCredentials, clerk_bearer
from core.config import Settings


class DebugEnvResponse(BaseModel):
    """Which required settings are non-empty (values never returned)."""

    clerk_jwt_issuer: bool
    clerk_jwt_audience: bool
    supabase_url: bool
    supabase_service_role_key: bool
    supabase_database_url: bool
    api_base_url: bool
    frontend_url: bool


class DebugAuthResponse(BaseModel):
    """Subset of verified JWT claims (requires valid Bearer)."""

    sub: str
    iss: str | None
    azp: str | None
    aud: Any
    expected_issuer: str
    expected_audience: str | None


def build_router(settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api/debug", tags=["debug"])
    guard = clerk_bearer(settings)

    @router.get("/env", response_model=DebugEnvResponse)
    async def debug_env(request: Request):
        _ = request
        return DebugEnvResponse(
            clerk_jwt_issuer=bool((settings.clerk_jwt_issuer or "").strip()),
            clerk_jwt_audience=bool((settings.clerk_jwt_audience or "").strip()),
            supabase_url=bool((settings.supabase_url or "").strip()),
            supabase_service_role_key=bool((settings.supabase_service_role_key or "").strip()),
            supabase_database_url=bool((settings.supabase_database_url or "").strip()),
            api_base_url=bool((settings.api_base_url or "").strip()),
            frontend_url=bool((settings.frontend_url or "").strip()),
        )

    @router.get("/auth", response_model=DebugAuthResponse)
    async def debug_auth(
        request: Request,
        creds: HTTPAuthorizationCredentials = Depends(guard),
    ):
        _ = request
        d = creds.decoded or {}
        exp_aud = (settings.clerk_jwt_audience or "").strip() or None
        iss_v = d.get("iss")
        azp_v = d.get("azp")
        return DebugAuthResponse(
            sub=str(d.get("sub") or ""),
            iss=str(iss_v) if iss_v is not None else None,
            azp=str(azp_v) if azp_v is not None else None,
            aud=d.get("aud"),
            expected_issuer=settings.clerk_jwt_issuer.strip().rstrip("/"),
            expected_audience=exp_aud,
        )

    return router
