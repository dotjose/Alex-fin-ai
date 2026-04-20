"""Single source of truth for per-account portfolio marks and weights."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, List

from services.account_portfolio_summary import decimal_from
from services.polygon_quote import fetch_last_price


def _qty(row: dict[str, Any]) -> Decimal:
    return decimal_from(row.get("quantity"))


def build_account_portfolio_snapshot(
    db: Any,
    *,
    account_id: str,
    polygon_api_key: str,
) -> dict[str, Any]:
    account = db.accounts.find_by_id(account_id)
    if not account:
        raise ValueError("account_not_found")

    cash = decimal_from(account.get("cash_balance"))
    rows = db.positions.find_by_account(account_id)

    holdings_raw: List[dict[str, Any]] = []
    for pos in rows:
        sym = str(pos.get("symbol") or "").upper()
        q = _qty(pos)
        pid = str(pos.get("id") or "")

        live_price, st = fetch_last_price(sym, polygon_api_key)
        if st == "ok" and live_price is not None:
            price_status = "ok"
            current_price = float(live_price)
            value = float(q * Decimal(str(live_price)))
        else:
            price_status = "price_unavailable" if st != "not_configured" else "not_configured"
            current_price = None
            value = 0.0

        inst = db.instruments.find_by_symbol(sym) if sym else None
        db_mark: float | None = None
        if inst and inst.get("current_price") is not None:
            try:
                db_mark = float(decimal_from(inst.get("current_price")))
            except Exception:
                db_mark = None

        holdings_raw.append(
            {
                "position_id": pid,
                "symbol": sym,
                "quantity": float(q),
                "average_price": db_mark,
                "current_price": current_price,
                "value": round(value, 2),
                "price_status": price_status,
            }
        )

    positions_value = sum(h["value"] for h in holdings_raw)
    total_value = float(cash) + positions_value

    holdings: List[dict[str, Any]] = []
    for h in holdings_raw:
        w: float | None
        if total_value > 0 and h["value"] > 0:
            w = round(100.0 * (h["value"] / total_value), 2)
        else:
            w = None
        holdings.append(
            {
                "position_id": h["position_id"],
                "symbol": h["symbol"],
                "quantity": h["quantity"],
                "average_price": h["average_price"],
                "current_price": h["current_price"],
                "value": h["value"],
                "weight": w,
                "price_status": h["price_status"],
            }
        )

    return {
        "account_id": account_id,
        "cash_balance": float(cash),
        "total_positions_value": round(positions_value, 2),
        "total_value": round(total_value, 2),
        "positions_count": len(holdings),
        "holdings": holdings,
    }
