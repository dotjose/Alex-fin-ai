from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from supabase import Client

from ..schemas import InstrumentCreate
from ._serialize import json_safe


class InstrumentRepository:
    table = "instruments"

    def __init__(self, client: Client):
        self._sb = client
        self._t = client.table(self.table)

    def find_all(self, limit: int = 10_000, offset: int = 0) -> List[Dict[str, Any]]:
        r = self._t.select("*").order("symbol").range(offset, offset + limit - 1).execute()
        return r.data or []

    def find_by_symbol(self, symbol: str) -> Optional[Dict[str, Any]]:
        r = self._t.select("*").eq("symbol", symbol).limit(1).execute()
        if r.data:
            return r.data[0]
        return None

    def find_by_type(self, instrument_type: str) -> List[Dict[str, Any]]:
        r = (
            self._t.select("*")
            .eq("instrument_type", instrument_type)
            .order("symbol")
            .execute()
        )
        return r.data or []

    def search(self, query: str) -> List[Dict[str, Any]]:
        safe = re.sub(r"[^a-zA-Z0-9.%\\-]", "", query)[:40]
        if not safe:
            return []
        pat = f"%{safe}%"
        a = self._t.select("*").ilike("symbol", pat).limit(20).execute().data or []
        b = self._t.select("*").ilike("name", pat).limit(20).execute().data or []
        seen: set[str] = set()
        out: List[Dict[str, Any]] = []
        for row in a + b:
            sym = row.get("symbol")
            if not sym or sym in seen:
                continue
            seen.add(sym)
            out.append(row)
        return out[:20]

    def create_instrument(self, instrument: InstrumentCreate) -> str:
        validated = instrument.model_dump()
        data = {
            "symbol": validated["symbol"],
            "name": validated["name"],
            "instrument_type": validated["instrument_type"],
            "allocation_regions": validated["allocation_regions"],
            "allocation_sectors": validated["allocation_sectors"],
            "allocation_asset_class": validated["allocation_asset_class"],
        }
        if validated.get("current_price") is not None:
            data["current_price"] = float(validated["current_price"])
        row = json_safe(data)
        self._t.insert(row).execute()
        return validated["symbol"]

    def create(self, data: Dict[str, Any], returning: str = "symbol") -> str:
        _ = returning
        row = json_safe(data)
        r = self._t.insert(row).execute()
        if not r.data:
            raise RuntimeError("insert instrument returned no row")
        return r.data[0]["symbol"]

    def update_by_symbol(self, symbol: str, data: Dict[str, Any]) -> int:
        row = json_safe({k: v for k, v in data.items() if v is not None})
        if not row:
            return 0
        self._t.update(row).eq("symbol", symbol).execute()
        return 1
