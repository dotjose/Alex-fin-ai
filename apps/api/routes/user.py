"""User profile endpoints."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from core.auth import HTTPAuthorizationCredentials, clerk_bearer, current_user_id_factory
from core.config import Settings
from services.supabase_client import get_database

logger = logging.getLogger(__name__)


class UserResponse(BaseModel):
    user: Dict[str, Any]
    created: bool


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    years_until_retirement: Optional[int] = None
    target_retirement_income: Optional[float] = None
    asset_class_targets: Optional[Dict[str, float]] = None
    region_targets: Optional[Dict[str, float]] = None


def build_router(settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["user"])
    guard = clerk_bearer(settings)
    get_uid = current_user_id_factory(settings)
    db = get_database()

    @router.get("/user", response_model=UserResponse)
    async def get_or_create_user(
        creds: HTTPAuthorizationCredentials = Depends(guard),
    ):
        clerk_user_id = creds.decoded["sub"]
        try:
            user = db.users.find_by_clerk_id(clerk_user_id)
            if user:
                return UserResponse(user=jsonable_encoder(user), created=False)

            token_data = creds.decoded
            display_name = (
                token_data.get("name")
                or token_data.get("email", "").split("@")[0]
                or "New User"
            )
            user_data = {
                "clerk_user_id": clerk_user_id,
                "display_name": display_name,
                "years_until_retirement": None,
                "target_retirement_income": None,
                "asset_class_targets": None,
                "region_targets": None,
            }
            db.users.insert_user(user_data)
            created_user = db.users.find_by_clerk_id(clerk_user_id)
            if not created_user:
                raise HTTPException(
                    status_code=500,
                    detail="User was created but could not be loaded.",
                )
            logger.info("Created new user: %s", clerk_user_id)
            return UserResponse(user=jsonable_encoder(created_user), created=True)
        except Exception as e:
            logger.error("Error in get_or_create_user: %s", e)
            raise HTTPException(status_code=500, detail="Failed to load user profile") from e

    @router.put("/user", response_model=UserResponse)
    async def update_user(
        user_update: UserUpdate,
        clerk_user_id: str = Depends(get_uid),
    ):
        try:
            user = db.users.find_by_clerk_id(clerk_user_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            update_data = user_update.model_dump(exclude_unset=True)
            db.users.update_by_clerk_id(clerk_user_id, update_data)
            updated = db.users.find_by_clerk_id(clerk_user_id)
            if not updated:
                raise HTTPException(status_code=404, detail="User not found")
            return UserResponse(user=jsonable_encoder(updated), created=False)
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error updating user: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    return router
