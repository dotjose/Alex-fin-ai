"""Account CRUD."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from core.auth import current_user_id_factory
from core.config import Settings
from core.route_errors import log_and_raise_http
from services.onboarding import provision_user_session
from services.portfolio_snapshot import build_account_portfolio_snapshot
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
            _, rows, _ = provision_user_session(db, clerk_user_id)
            return jsonable_encoder(rows)
        except Exception as e:
            log_and_raise_http(logger, e, context="GET /api/accounts")

    @router.get("/accounts/{account_id}/portfolio")
    async def get_account_portfolio(account_id: str, clerk_user_id: str = Depends(get_uid)):
        """Authoritative marks, values, and weights (Polygon + DB positions)."""
        try:
            account = db.accounts.find_by_id(account_id)
            if not account:
                raise HTTPException(status_code=404, detail="Account not found")
            if account.get("clerk_user_id") != clerk_user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            snap = build_account_portfolio_snapshot(
                db,
                account_id=account_id,
                polygon_api_key=settings.polygon_api_key,
            )
            return jsonable_encoder(snap)
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="GET /api/accounts/{account_id}/portfolio")

    @router.post("/accounts")
    async def create_account(
        account: AccountCreate,
        clerk_user_id: str = Depends(get_uid),
    ):
        try:
            provision_user_session(db, clerk_user_id)
            account_id = db.accounts.create_account(
                clerk_user_id=clerk_user_id,
                account_name=account.account_name,
                account_purpose=account.account_purpose,
                cash_balance=getattr(account, "cash_balance", Decimal("0")),
            )
            row = db.accounts.find_by_id(account_id)
            if not row:
                raise HTTPException(status_code=500, detail="Account was created but could not be loaded.")
            return jsonable_encoder(row)
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="POST /api/accounts")

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
            row = db.accounts.find_by_id(account_id)
            if not row:
                raise HTTPException(status_code=404, detail="Account not found")
            return jsonable_encoder(row)
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="PUT /api/accounts/{account_id}")

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
            log_and_raise_http(logger, e, context="DELETE /api/accounts/{account_id}")

    return router
