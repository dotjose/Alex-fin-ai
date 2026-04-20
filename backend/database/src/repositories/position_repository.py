from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from postgrest.types import ReturnMethod
from supabase import Client

from ._serialize import json_safe

logger = logging.getLogger(__name__)


class PositionPersistenceError(RuntimeError):
    """Raised when a position cannot be written or its id cannot be determined."""


class PositionRepository:
    table = "positions"

    def __init__(self, client: Client):
        self._sb = client
        self._t = client.table(self.table)
        self._instruments = client.table("instruments")

    def find_by_account(self, account_id: str) -> List[Dict[str, Any]]:
        r = (
            self._t.select("*")
            .eq("account_id", account_id)
            .order("symbol")
            .execute()
        )
        rows = r.data or []
        out: List[Dict[str, Any]] = []
        for p in rows:
            ir = (
                self._instruments.select("name, instrument_type, current_price")
                .eq("symbol", p["symbol"])
                .limit(1)
                .execute()
            )
            if ir.data:
                inst = ir.data[0]
                p = {
                    **p,
                    "instrument_name": inst.get("name"),
                    "instrument_type": inst.get("instrument_type"),
                    "current_price": inst.get("current_price"),
                }
            out.append(p)
        return out

    def find_by_account_and_symbol(
        self, account_id: str, symbol: str
    ) -> Optional[Dict[str, Any]]:
        r = (
            self._t.select("*")
            .eq("account_id", account_id)
            .eq("symbol", symbol)
            .limit(1)
            .execute()
        )
        if r.data:
            return r.data[0]
        return None

    def find_by_id(self, position_id: str) -> Optional[Dict[str, Any]]:
        try:
            r = self._t.select("*").eq("id", position_id).limit(1).execute()
        except Exception:
            logger.exception("positions.find_by_id failed position_id=%s", position_id)
            raise
        if r.data:
            return r.data[0]
        return None

    def _id_by_account_and_symbol(self, account_id: str, symbol: str) -> Optional[str]:
        """Fallback when upsert/insert does not return a row (Prefer header / RLS edge cases)."""
        r = (
            self._t.select("id")
            .eq("account_id", account_id)
            .eq("symbol", symbol)
            .limit(1)
            .execute()
        )
        if not r.data:
            return None
        return self._parse_uuid_id(r.data[0].get("id"), context="fallback_select")

    @staticmethod
    def _parse_uuid_id(raw: Any, *, context: str) -> str:
        if raw is None:
            raise PositionPersistenceError(f"Position row missing id ({context})")
        try:
            return str(UUID(str(raw)))
        except ValueError as e:
            raise PositionPersistenceError(
                f"Position id is not a valid UUID ({context}): {raw!r}"
            ) from e

    def add_position(self, account_id: str, symbol: str, quantity: Decimal) -> str:
        row = json_safe(
            {
                "account_id": account_id,
                "symbol": symbol,
                "quantity": quantity,
                "as_of_date": date.today().isoformat(),
            }
        )
        try:
            # postgrest-py 2.x: upsert() returns SyncQueryRequestBuilder — no chained .select().
            r = self._t.upsert(
                row,
                on_conflict="account_id,symbol",
                returning=ReturnMethod.representation,
            ).execute()
            logger.info(
                "positions.upsert ok account_id=%s symbol=%s rows_returned=%s",
                account_id,
                symbol,
                len(r.data or []),
            )
        except Exception as e:
            logger.exception(
                "positions.upsert failed account_id=%s symbol=%s",
                account_id,
                symbol,
            )
            raise PositionPersistenceError("Failed to upsert position") from e

        if r.data:
            try:
                return self._parse_uuid_id(r.data[0].get("id"), context="upsert_response")
            except PositionPersistenceError:
                logger.exception(
                    "positions.upsert returned row without usable id account_id=%s symbol=%s",
                    account_id,
                    symbol,
                )
                raise

        logger.warning(
            "positions.upsert returned no representation; fetching by account_id+symbol "
            "account_id=%s symbol=%s",
            account_id,
            symbol,
        )
        fallback = self._id_by_account_and_symbol(account_id, symbol)
        if fallback:
            logger.info(
                "positions.upsert fallback resolved id=%s account_id=%s symbol=%s",
                fallback,
                account_id,
                symbol,
            )
            return fallback

        logger.error(
            "positions.upsert no row and fallback miss account_id=%s symbol=%s",
            account_id,
            symbol,
        )
        raise PositionPersistenceError("Upsert returned no row and fallback found none")

    def update(self, position_id: str, data: Dict[str, Any]) -> int:
        row = json_safe({k: v for k, v in data.items() if v is not None})
        if not row:
            return 0
        try:
            r = (
                self._t.update(row, returning=ReturnMethod.representation)
                .eq("id", position_id)
                .execute()
            )
            logger.info(
                "positions.update ok position_id=%s rows_returned=%s",
                position_id,
                len(r.data or []),
            )
        except Exception as e:
            logger.exception("positions.update failed position_id=%s", position_id)
            raise PositionPersistenceError("Failed to update position") from e
        return 1

    def delete(self, position_id: str) -> int:
        try:
            self._t.delete().eq("id", position_id).execute()
        except Exception:
            logger.exception("positions.delete failed position_id=%s", position_id)
            raise
        return 1

    def create(self, data: Dict[str, Any], returning: str = "id") -> str:
        _ = returning
        row = json_safe(data)
        account_id = row.get("account_id")
        symbol = row.get("symbol")
        try:
            r = self._t.insert(row, returning=ReturnMethod.representation).execute()
            logger.info(
                "positions.insert ok rows_returned=%s account_id=%s symbol=%s",
                len(r.data or []),
                account_id,
                symbol,
            )
        except Exception as e:
            logger.exception(
                "positions.insert failed account_id=%s symbol=%s",
                account_id,
                symbol,
            )
            raise PositionPersistenceError("Failed to insert position") from e

        if r.data:
            try:
                return self._parse_uuid_id(r.data[0].get("id"), context="insert_response")
            except PositionPersistenceError:
                logger.exception(
                    "positions.insert returned row without usable id account_id=%s symbol=%s",
                    account_id,
                    symbol,
                )
                raise

        if isinstance(account_id, str) and isinstance(symbol, str):
            logger.warning(
                "positions.insert returned no representation; fetching by account_id+symbol "
                "account_id=%s symbol=%s",
                account_id,
                symbol,
            )
            fallback = self._id_by_account_and_symbol(account_id, symbol)
            if fallback:
                logger.info(
                    "positions.insert fallback resolved id=%s account_id=%s symbol=%s",
                    fallback,
                    account_id,
                    symbol,
                )
                return fallback

        logger.error(
            "positions.insert no row and no fallback account_id=%s symbol=%s",
            account_id,
            symbol,
        )
        raise PositionPersistenceError("Insert returned no row and fallback found none")

    def get_portfolio_value(self, account_id: str) -> Dict[str, Any]:
        positions = self.find_by_account(account_id)
        num_positions = len({p["symbol"] for p in positions})
        total_value = 0.0
        total_shares = 0.0
        for p in positions:
            q = float(p.get("quantity") or 0)
            total_shares += q
            price = p.get("current_price")
            if price is not None:
                total_value += q * float(price)
        return {
            "num_positions": num_positions,
            "total_value": total_value,
            "total_shares": total_shares,
        }
