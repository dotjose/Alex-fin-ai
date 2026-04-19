"""Clerk JWT verification for FastAPI (issuer/audience-aware, 401 on auth failures)."""

from __future__ import annotations

import logging
from typing import Any, Optional

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.security import HTTPAuthorizationCredentials as FastAPIHTTPAuthorizationCredentials
from fastapi.security import HTTPBearer
from fastapi.security.utils import get_authorization_scheme_param
from jwt import PyJWKClient
from starlette import status

from core.config import Settings

logger = logging.getLogger(__name__)


class HTTPAuthorizationCredentials(FastAPIHTTPAuthorizationCredentials):
    """Same shape as fastapi-clerk-auth (decoded claims on the credential object)."""

    decoded: dict[str, Any] | None = None


def _normalize_issuer(raw: str) -> str:
    return (raw or "").strip().rstrip("/")


def _token_claims_for_log(token: str) -> tuple[Any, Any, Any]:
    """iss / aud / azp from token without verifying signature (logging only)."""
    try:
        claims = jwt.decode(
            token,
            options={
                "verify_signature": False,
                "verify_exp": False,
                "verify_aud": False,
                "verify_iss": False,
            },
        )
        return claims.get("iss"), claims.get("aud"), claims.get("azp")
    except Exception:
        return None, None, None


def _log_jwt_mismatch(
    *,
    token_iss: Any,
    token_aud: Any,
    token_azp: Any,
    expected_issuer: str,
    expected_audience: str | None,
    reason: str,
) -> None:
    logger.warning(
        "jwt_validation_failed reason=%s token_iss=%r token_aud=%r token_azp=%r "
        "expected_issuer=%r expected_audience=%r",
        reason,
        token_iss,
        token_aud,
        token_azp,
        expected_issuer,
        expected_audience,
    )


class ClerkJWTBearer(HTTPBearer):
    """
    Verifies Clerk session JWTs via JWKS.

    - ``CLERK_JWT_ISSUER`` (required): used for JWKS URL and issuer verification.
    - ``CLERK_JWT_AUDIENCE`` (optional): when set, ``aud`` is enforced; when unset, audience is not verified
      (avoids prod/local mismatches when Clerk omits or varies ``aud``).
    """

    def __init__(self, settings: Settings, *, auto_error: bool = True) -> None:
        super().__init__(auto_error=auto_error)
        self.auto_error = auto_error
        self._expected_issuer = _normalize_issuer(settings.clerk_jwt_issuer)
        aud = (settings.clerk_jwt_audience or "").strip()
        self._expected_audience: str | None = aud if aud else None
        self._verify_aud = self._expected_audience is not None
        self._jwks_client = PyJWKClient(
            uri=settings.clerk_jwks_url,
            cache_keys=False,
            max_cached_keys=16,
            cache_jwk_set=True,
            lifespan=300,
            headers=None,
            timeout=30,
        )

    def _decode(self, token: str) -> dict[str, Any]:
        token_iss, token_aud, token_azp = _token_claims_for_log(token)
        decode_kwargs: dict[str, Any] = {
            "algorithms": ["RS256"],
            "issuer": self._expected_issuer,
            "options": {
                "verify_exp": True,
                "verify_aud": self._verify_aud,
                "verify_iss": True,
                "verify_iat": True,
            },
            "leeway": 5,
        }
        if self._verify_aud and self._expected_audience is not None:
            decode_kwargs["audience"] = self._expected_audience

        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            decoded = jwt.decode(token, signing_key.key, **decode_kwargs)
            return dict(jsonable_encoder(decoded))
        except jwt.PyJWKClientError as e:
            _log_jwt_mismatch(
                token_iss=token_iss,
                token_aud=token_aud,
                token_azp=token_azp,
                expected_issuer=self._expected_issuer,
                expected_audience=self._expected_audience,
                reason=type(e).__name__,
            )
            logger.error("clerk_jwks_client_error: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to reach authentication keys. Retry shortly.",
            ) from e
        except jwt.PyJWTError as e:
            _log_jwt_mismatch(
                token_iss=token_iss,
                token_aud=token_aud,
                token_azp=token_azp,
                expected_issuer=self._expected_issuer,
                expected_audience=self._expected_audience,
                reason=type(e).__name__,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token.",
            ) from e

    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        authorization = request.headers.get("Authorization")
        scheme, credentials = get_authorization_scheme_param(authorization)
        if not (authorization and scheme and credentials):
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated.",
                )
            return None
        if scheme.lower() != "bearer":
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication scheme.",
                )
            return None

        decoded = self._decode(credentials)
        return HTTPAuthorizationCredentials(
            scheme=scheme,
            credentials=credentials,
            decoded=decoded,
        )


def clerk_bearer(settings: Settings) -> ClerkJWTBearer:
    return ClerkJWTBearer(settings, auto_error=True)


def current_user_id_factory(settings: Settings):
    guard = clerk_bearer(settings)

    async def get_current_user_id(
        creds: HTTPAuthorizationCredentials = Depends(guard),
    ) -> str:
        if not creds.decoded or "sub" not in creds.decoded:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload.",
            )
        return str(creds.decoded["sub"])

    return get_current_user_id
