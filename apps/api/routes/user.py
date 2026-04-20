"""User profile endpoints."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from core.auth import HTTPAuthorizationCredentials, clerk_bearer, current_user_id_factory
from core.config import Settings
from core.route_errors import log_and_raise_http
from services.supabase_client import get_database

logger = logging.getLogger(__name__)


class UserGetResponse(BaseModel):
    """
    GET /api/user — always includes ``user_id`` from JWT; ``user`` is the full
    Supabase row when a profile exists, else ``None``.
    """

    user_id: str
    user: Optional[Dict[str, Any]] = None


class UserResponse(BaseModel):
    user: Dict[str, Any]
    created: bool


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    years_until_retirement: Optional[int] = None
    target_retirement_income: Optional[float] = None
    asset_class_targets: Optional[Dict[str, float]] = None
    region_targets: Optional[Dict[str, float]] = None


def _merge_mapping(
    existing: Any, patch: Optional[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """Shallow-merge JSON object columns so partial payloads do not wipe sibling keys."""
    if patch is None:
        return None
    base: Dict[str, Any] = dict(existing) if isinstance(existing, dict) else {}
    merged = {**base, **patch}
    return merged


def build_router(settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["user"])
    guard = clerk_bearer(settings)
    get_uid = current_user_id_factory(settings)
    db = get_database()

    @router.get("/user", response_model=UserGetResponse)
    async def get_user_identity(creds: HTTPAuthorizationCredentials = Depends(guard)):
        """Return JWT ``user_id`` plus full profile row from DB when it exists."""
        try:
            decoded = creds.decoded or {}
            user_id = str(decoded.get("sub", "")).strip()
            if not user_id:
                raise HTTPException(
                    status_code=401,
                    detail="Token is missing subject (sub).",
                )
            expected_issuer = settings.clerk_jwt_issuer.strip().rstrip("/")
            expected_audience = (settings.clerk_jwt_audience or "").strip() or None
            logger.info(
                "api_user_jwt_debug token_iss=%r token_azp=%r token_aud=%r "
                "expected_issuer=%r expected_audience=%r",
                decoded.get("iss"),
                decoded.get("azp"),
                decoded.get("aud"),
                expected_issuer,
                expected_audience,
            )
            row = db.users.find_by_clerk_id(user_id)
            return UserGetResponse(
                user_id=user_id,
                user=jsonable_encoder(row) if row else None,
            )
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="GET /api/user")

    @router.put("/user", response_model=UserResponse)
    async def update_user(
        user_update: UserUpdate,
        clerk_user_id: str = Depends(get_uid),
    ):
        try:
            user = db.users.find_by_clerk_id(clerk_user_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            update_data = user_update.model_dump(exclude_unset=True, exclude_none=True)
            if "asset_class_targets" in update_data:
                merged = _merge_mapping(
                    user.get("asset_class_targets"),
                    update_data.get("asset_class_targets"),
                )
                if merged is not None:
                    update_data["asset_class_targets"] = merged
            if "region_targets" in update_data:
                merged_r = _merge_mapping(
                    user.get("region_targets"),
                    update_data.get("region_targets"),
                )
                if merged_r is not None:
                    update_data["region_targets"] = merged_r
            logger.info(
                "api_user_put keys=%s job_meta=merge_json_targets",
                list(update_data.keys()),
            )
            db.users.update_by_clerk_id(clerk_user_id, update_data)
            updated = db.users.find_by_clerk_id(clerk_user_id)
            if not updated:
                raise HTTPException(status_code=404, detail="User not found")
            logger.info(
                "api_user_put_ok clerk_user_id=%s has_asset=%s has_region=%s",
                clerk_user_id,
                updated.get("asset_class_targets") is not None,
                updated.get("region_targets") is not None,
            )
            return UserResponse(user=jsonable_encoder(updated), created=False)
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="PUT /api/user")

    return router
