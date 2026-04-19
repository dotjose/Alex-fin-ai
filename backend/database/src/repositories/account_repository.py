from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from supabase import Client

from ._serialize import json_safe


class AccountRepository:
    table = "accounts"

    def __init__(self, client: Client):
        self._sb = client
        self._t = client.table(self.table)

    def find_by_user(self, clerk_user_id: str) -> List[Dict[str, Any]]:
        r = (
            self._t.select("*")
            .eq("clerk_user_id", clerk_user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return r.data or []

    def find_by_id(self, account_id: str) -> Optional[Dict[str, Any]]:
        r = self._t.select("*").eq("id", account_id).limit(1).execute()
        if r.data:
            return r.data[0]
        return None

    def create_account(
        self,
        clerk_user_id: str,
        account_name: str,
        account_purpose: str | None,
        cash_balance: Decimal = Decimal("0"),
        cash_interest: Decimal = Decimal("0"),
    ) -> str:
        row = json_safe(
            {
                "clerk_user_id": clerk_user_id,
                "account_name": account_name,
                "account_purpose": account_purpose,
                "cash_balance": cash_balance,
                "cash_interest": cash_interest,
            }
        )
        r = self._t.insert(row).execute()
        if not r.data:
            raise RuntimeError("insert account returned no row")
        return r.data[0]["id"]

    def update(self, account_id: str, data: Dict[str, Any]) -> int:
        row = json_safe({k: v for k, v in data.items() if v is not None})
        if not row:
            return 0
        self._t.update(row).eq("id", account_id).execute()
        return 1

    def delete(self, account_id: str) -> int:
        self._t.delete().eq("id", account_id).execute()
        return 1

    def create(self, data: Dict[str, Any], returning: str = "id") -> str:
        _ = returning
        row = json_safe(data)
        r = self._t.insert(row).execute()
        if not r.data:
            raise RuntimeError("insert account returned no row")
        return r.data[0]["id"]
