from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional

from supabase import Client

from ._serialize import json_safe


class UserRepository:
    table = "users"

    def __init__(self, client: Client):
        self._sb = client
        self._t = client.table(self.table)

    def find_by_clerk_id(self, clerk_user_id: str) -> Optional[Dict[str, Any]]:
        r = (
            self._t.select("*")
            .eq("clerk_user_id", clerk_user_id)
            .limit(1)
            .execute()
        )
        if r.data:
            return r.data[0]
        return None

    def insert_user(self, data: Dict[str, Any]) -> str:
        row = json_safe(data)
        # postgrest-py 2.x: insert() returns SyncQueryRequestBuilder (no .select()).
        # Default Prefer: return=representation — response includes the inserted row.
        r = self._t.insert(row).execute()
        if not r.data:
            raise RuntimeError("insert user returned no row")
        return r.data[0]["clerk_user_id"]

    def create_user(
        self,
        clerk_user_id: str,
        display_name: str | None = None,
        years_until_retirement: int | None = None,
        target_retirement_income: Decimal | None = None,
    ) -> str:
        data: Dict[str, Any] = {"clerk_user_id": clerk_user_id}
        if display_name is not None:
            data["display_name"] = display_name
        if years_until_retirement is not None:
            data["years_until_retirement"] = years_until_retirement
        if target_retirement_income is not None:
            data["target_retirement_income"] = target_retirement_income
        return self.insert_user(data)

    def create(self, data: Dict[str, Any], returning: str = "clerk_user_id") -> str:
        _ = returning
        return self.insert_user(data)

    def update_by_clerk_id(self, clerk_user_id: str, data: Dict[str, Any]) -> None:
        row = json_safe({k: v for k, v in data.items() if v is not None})
        if not row:
            return
        self._t.update(row).eq("clerk_user_id", clerk_user_id).execute()
