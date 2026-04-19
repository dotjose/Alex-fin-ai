"""Clerk JWT verification (fastapi-clerk-auth)."""

from __future__ import annotations

from fastapi import Depends
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials

from core.config import Settings


def clerk_bearer(settings: Settings) -> ClerkHTTPBearer:
    return ClerkHTTPBearer(ClerkConfig(jwks_url=settings.clerk_jwks_url))


def current_user_id_factory(settings: Settings):
    guard = clerk_bearer(settings)

    async def get_current_user_id(
        creds: HTTPAuthorizationCredentials = Depends(guard),
    ) -> str:
        return creds.decoded["sub"]

    return get_current_user_id
