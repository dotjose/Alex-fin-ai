"""Account CRUD."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import current_user_id_factory
from core.config import Settings
from services.supabase_client import get_database
from src.schemas import AccountCreate

logger = logging.getLogger(__name__)


class AccountUpdate(BaseModel):
    account_name: Optional[str] = None
    account_purpose: Optional[str] = None
    cash_balance: Optional[float] = None


def build_router(settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["accounts"])
    get_uid = current_user_id_factory(settings)
    db = get_database()

    @router.get("/accounts")
    async def list_accounts(clerk_user_id: str = Depends(get_uid)):
        try:
            return db.accounts.find_by_user(clerk_user_id)
        except Exception as e:
            logger.error("Error listing accounts: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    @router.post("/accounts")
    async def create_account(
        account: AccountCreate,
        clerk_user_id: str = Depends(get_uid),
    ):
        try:
            user = db.users.find_by_clerk_id(clerk_user_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            account_id = db.accounts.create_account(
                clerk_user_id=clerk_user_id,
                account_name=account.account_name,
                account_purpose=account.account_purpose,
                cash_balance=getattr(account, "cash_balance", Decimal("0")),
            )
            return db.accounts.find_by_id(account_id)
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error creating account: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    @router.put("/accounts/{account_id}")
    async def update_account(
        account_id: str,
        account_update: AccountUpdate,
        clerk_user_id: str = Depends(get_uid),
    ):
        try:
            account = db.accounts.find_by_id(account_id)
            if not account:
                raise HTTPException(status_code=404, detail="Account not found")
            if account.get("clerk_user_id") != clerk_user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            update_data = account_update.model_dump(exclude_unset=True)
            db.accounts.update(account_id, update_data)
            return db.accounts.find_by_id(account_id)
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error updating account: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    @router.delete("/accounts/{account_id}")
    async def delete_account(account_id: str, clerk_user_id: str = Depends(get_uid)):
        try:
            account = db.accounts.find_by_id(account_id)
            if not account:
                raise HTTPException(status_code=404, detail="Account not found")
            if account.get("clerk_user_id") != clerk_user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            for position in db.positions.find_by_account(account_id):
                db.positions.delete(position["id"])
            db.accounts.delete(account_id)
            return {"message": "Account deleted successfully"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error deleting account: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    return router
