"""Positions and instruments."""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import current_user_id_factory
from core.config import Settings
from services.supabase_client import get_database
from src.schemas import InstrumentCreate, PositionCreate

logger = logging.getLogger(__name__)


class PositionUpdate(BaseModel):
    quantity: Optional[float] = None


def build_router(settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["portfolio"])
    get_uid = current_user_id_factory(settings)
    db = get_database()

    @router.get("/accounts/{account_id}/positions")
    async def list_positions(account_id: str, clerk_user_id: str = Depends(get_uid)):
        try:
            account = db.accounts.find_by_id(account_id)
            if not account:
                raise HTTPException(status_code=404, detail="Account not found")
            if account.get("clerk_user_id") != clerk_user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            formatted = []
            for pos in db.positions.find_by_account(account_id):
                inst = db.instruments.find_by_symbol(pos["symbol"])
                formatted.append({**pos, "instrument": inst})
            return {"positions": formatted}
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error listing positions: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    @router.post("/positions")
    async def create_position(
        position: PositionCreate,
        clerk_user_id: str = Depends(get_uid),
    ):
        try:
            account = db.accounts.find_by_id(position.account_id)
            if not account:
                raise HTTPException(status_code=404, detail="Account not found")
            if account.get("clerk_user_id") != clerk_user_id:
                raise HTTPException(status_code=403, detail="Not authorized")

            symbol_upper = position.symbol.upper()
            if not db.instruments.find_by_symbol(symbol_upper):
                sym = symbol_upper
                instrument_type = "stock" if len(sym) <= 5 and sym.isalpha() else "etf"
                new_instrument = InstrumentCreate(
                    symbol=sym,
                    name=f"{sym} - User Added",
                    instrument_type=instrument_type,
                    current_price=Decimal("0.00"),
                    allocation_regions={"north_america": 100.0},
                    allocation_sectors={"other": 100.0},
                    allocation_asset_class=(
                        {"equity": 100.0} if instrument_type == "stock" else {"fixed_income": 100.0}
                    ),
                )
                db.instruments.create_instrument(new_instrument)

            position_id = db.positions.add_position(
                account_id=position.account_id,
                symbol=symbol_upper,
                quantity=position.quantity,
            )
            return db.positions.find_by_id(position_id)
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error creating position: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    @router.put("/positions/{position_id}")
    async def update_position(
        position_id: str,
        position_update: PositionUpdate,
        clerk_user_id: str = Depends(get_uid),
    ):
        try:
            position = db.positions.find_by_id(position_id)
            if not position:
                raise HTTPException(status_code=404, detail="Position not found")
            account = db.accounts.find_by_id(position["account_id"])
            if not account or account.get("clerk_user_id") != clerk_user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            update_data = position_update.model_dump(exclude_unset=True)
            db.positions.update(position_id, update_data)
            return db.positions.find_by_id(position_id)
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error updating position: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    @router.delete("/positions/{position_id}")
    async def delete_position(position_id: str, clerk_user_id: str = Depends(get_uid)):
        try:
            position = db.positions.find_by_id(position_id)
            if not position:
                raise HTTPException(status_code=404, detail="Position not found")
            account = db.accounts.find_by_id(position["account_id"])
            if not account or account.get("clerk_user_id") != clerk_user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            db.positions.delete(position_id)
            return {"message": "Position deleted"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error deleting position: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    @router.get("/instruments")
    async def list_instruments(clerk_user_id: str = Depends(get_uid)):
        _ = clerk_user_id
        try:
            instruments = db.instruments.find_all()
            return [
                {
                    "symbol": inst["symbol"],
                    "name": inst["name"],
                    "instrument_type": inst["instrument_type"],
                    "current_price": float(inst["current_price"]) if inst.get("current_price") else None,
                }
                for inst in instruments
            ]
        except Exception as e:
            logger.error("Error fetching instruments: %s", e)
            raise HTTPException(status_code=500, detail=str(e)) from e

    return router
