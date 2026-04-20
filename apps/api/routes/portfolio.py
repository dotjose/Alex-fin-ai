"""Positions and instruments."""

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
from services.account_portfolio_summary import decimal_from, summarize_account
from services.supabase_client import get_database
from src import PositionPersistenceError
from src.schemas import InstrumentCreate, PositionCreate

logger = logging.getLogger(__name__)


def _enriched_position(db, row: dict) -> dict:
    sym = row.get("symbol")
    inst = db.instruments.find_by_symbol(sym) if sym else None
    return {**row, "instrument": inst}


def _position_mutation_payload(db, account_id: str, row: dict) -> dict:
    acct = db.accounts.find_by_id(account_id)
    if not acct:
        raise RuntimeError("account missing after position mutation")
    summary = summarize_account(db, account_id)
    return {
        "position": _enriched_position(db, row),
        "account": acct,
        "summary": summary,
    }


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
            return jsonable_encoder({"positions": formatted})
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="GET /api/accounts/{account_id}/positions")

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

            inst_row = db.instruments.find_by_symbol(symbol_upper)
            price = decimal_from(inst_row.get("current_price")) if inst_row else Decimal(0)

            existing = db.positions.find_by_account_and_symbol(
                position.account_id, symbol_upper
            )
            old_qty = decimal_from(existing["quantity"]) if existing else Decimal(0)
            new_qty = decimal_from(position.quantity)
            delta = new_qty - old_qty
            trade = delta * price
            cash = decimal_from(account.get("cash_balance"))

            if trade > 0 and cash < trade:
                raise HTTPException(
                    status_code=400,
                    detail="Insufficient cash for this trade at the current mark.",
                )

            position_id: str | None = None
            try:
                position_id = db.positions.add_position(
                    account_id=position.account_id,
                    symbol=symbol_upper,
                    quantity=position.quantity,
                )
            except PositionPersistenceError as e:
                raise HTTPException(
                    status_code=500,
                    detail="Could not save the position. Please try again.",
                ) from e

            try:
                row = db.positions.find_by_id(position_id)
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail="Position was saved but could not be loaded.",
                ) from e
            if not row:
                logger.error(
                    "POST /api/positions empty row after save position_id=%s",
                    position_id,
                )
                raise HTTPException(
                    status_code=500,
                    detail="Position was saved but could not be loaded.",
                )

            if trade != 0:
                try:
                    db.accounts.update(
                        position.account_id,
                        {"cash_balance": cash - trade},
                    )
                except Exception as e:
                    try:
                        if existing:
                            db.positions.update(position_id, {"quantity": old_qty})
                        else:
                            db.positions.delete(position_id)
                    except Exception:
                        logger.critical(
                            "POST /api/positions cash update failed and position rollback failed "
                            "position_id=%s",
                            position_id,
                            exc_info=True,
                        )
                    raise HTTPException(
                        status_code=500,
                        detail="Could not update cash after saving the position.",
                    ) from e

            return jsonable_encoder(
                _position_mutation_payload(db, position.account_id, row)
            )
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="POST /api/positions")

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
            account_id = str(position["account_id"])
            symbol = str(position["symbol"])
            inst_row = db.instruments.find_by_symbol(symbol)
            price = decimal_from(inst_row.get("current_price")) if inst_row else Decimal(0)
            old_qty = decimal_from(position.get("quantity"))
            cash = decimal_from(account.get("cash_balance"))

            trade = Decimal(0)
            new_qty = old_qty
            if "quantity" in update_data and update_data["quantity"] is not None:
                new_qty = decimal_from(update_data["quantity"])
                trade = (new_qty - old_qty) * price
                if trade > 0 and cash < trade:
                    raise HTTPException(
                        status_code=400,
                        detail="Insufficient cash for this trade at the current mark.",
                    )

            try:
                db.positions.update(position_id, update_data)
            except PositionPersistenceError as e:
                raise HTTPException(
                    status_code=500,
                    detail="Could not update the position. Please try again.",
                ) from e
            try:
                row = db.positions.find_by_id(position_id)
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail="Position was updated but could not be reloaded.",
                ) from e
            if not row:
                raise HTTPException(
                    status_code=500,
                    detail="Position was updated but could not be reloaded.",
                )

            if trade != 0:
                try:
                    db.accounts.update(account_id, {"cash_balance": cash - trade})
                except Exception as e:
                    try:
                        db.positions.update(position_id, {"quantity": old_qty})
                    except Exception:
                        logger.critical(
                            "PUT /api/positions cash update failed and quantity rollback failed "
                            "position_id=%s",
                            position_id,
                            exc_info=True,
                        )
                    raise HTTPException(
                        status_code=500,
                        detail="Could not update cash after updating the position.",
                    ) from e

            return jsonable_encoder(_position_mutation_payload(db, account_id, row))
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="PUT /api/positions/{position_id}")

    @router.delete("/positions/{position_id}")
    async def delete_position(position_id: str, clerk_user_id: str = Depends(get_uid)):
        try:
            position = db.positions.find_by_id(position_id)
            if not position:
                raise HTTPException(status_code=404, detail="Position not found")
            account = db.accounts.find_by_id(position["account_id"])
            if not account or account.get("clerk_user_id") != clerk_user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            account_id = str(position["account_id"])
            symbol = str(position["symbol"])
            qty = decimal_from(position.get("quantity"))
            inst_row = db.instruments.find_by_symbol(symbol)
            price = decimal_from(inst_row.get("current_price")) if inst_row else Decimal(0)
            proceeds = qty * price
            cash = decimal_from(account.get("cash_balance"))

            if proceeds != 0:
                try:
                    db.accounts.update(account_id, {"cash_balance": cash + proceeds})
                except Exception as e:
                    raise HTTPException(
                        status_code=500,
                        detail="Could not credit cash before removing the position.",
                    ) from e
            try:
                db.positions.delete(position_id)
            except Exception as e:
                if proceeds != 0:
                    try:
                        db.accounts.update(account_id, {"cash_balance": cash})
                    except Exception:
                        logger.critical(
                            "DELETE /api/positions delete failed and cash revert failed "
                            "position_id=%s",
                            position_id,
                            exc_info=True,
                        )
                raise HTTPException(
                    status_code=500,
                    detail="Could not delete the position.",
                ) from e

            acct = db.accounts.find_by_id(account_id)
            summary = summarize_account(db, account_id)
            return jsonable_encoder(
                {
                    "message": "Position deleted",
                    "account": acct,
                    "summary": summary,
                }
            )
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="DELETE /api/positions/{position_id}")

    @router.get("/instruments")
    async def list_instruments(clerk_user_id: str = Depends(get_uid)):
        _ = clerk_user_id
        try:
            instruments = db.instruments.find_all()
            out = [
                {
                    "symbol": inst["symbol"],
                    "name": inst["name"],
                    "instrument_type": inst["instrument_type"],
                    "current_price": float(inst["current_price"]) if inst.get("current_price") else None,
                }
                for inst in instruments
            ]
            return jsonable_encoder(out)
        except Exception as e:
            log_and_raise_http(logger, e, context="GET /api/instruments")

    return router
