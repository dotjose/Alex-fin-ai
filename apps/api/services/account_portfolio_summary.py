"""Account-level cash + holdings totals for API responses (authoritative with DB state)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any


def decimal_from(value: Any) -> Decimal:
    if value is None:
        return Decimal(0)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def summarize_account(db: Any, account_id: str) -> dict[str, float]:
    """total_value = cash_balance + sum(quantity * current_price) using joined instrument prices."""
    account = db.accounts.find_by_id(account_id)
    if not account:
        raise ValueError("account not found")
    cash = decimal_from(account.get("cash_balance"))
    holdings = Decimal(0)
    for p in db.positions.find_by_account(account_id):
        q = decimal_from(p.get("quantity"))
        px = p.get("current_price")
        if px is None:
            continue
        holdings += q * decimal_from(px)
    total = cash + holdings
    return {
        "cash_balance": float(cash),
        "holdings_value": float(holdings),
        "total_value": float(total),
    }
