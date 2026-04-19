from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from supabase import Client

from ._serialize import json_safe


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

    def find_by_id(self, position_id: str) -> Optional[Dict[str, Any]]:
        r = self._t.select("*").eq("id", position_id).limit(1).execute()
        if r.data:
            return r.data[0]
        return None

    def add_position(self, account_id: str, symbol: str, quantity: Decimal) -> str:
        row = json_safe(
            {
                "account_id": account_id,
                "symbol": symbol,
                "quantity": quantity,
                "as_of_date": date.today().isoformat(),
            }
        )
        r = (
            self._t.upsert(row, on_conflict="account_id,symbol")
            .select("id")
            .execute()
        )
        if not r.data:
            raise RuntimeError("upsert position returned no row")
        return r.data[0]["id"]

    def update(self, position_id: str, data: Dict[str, Any]) -> int:
        row = json_safe({k: v for k, v in data.items() if v is not None})
        if not row:
            return 0
        self._t.update(row).eq("id", position_id).execute()
        return 1

    def delete(self, position_id: str) -> int:
        self._t.delete().eq("id", position_id).execute()
        return 1

    def create(self, data: Dict[str, Any], returning: str = "id") -> str:
        _ = returning
        row = json_safe(data)
        r = self._t.insert(row).execute()
        if not r.data:
            raise RuntimeError("insert position returned no row")
        return r.data[0]["id"]

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
