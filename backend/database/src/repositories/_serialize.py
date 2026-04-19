"""Normalize Python values for PostgREST payloads."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict


def json_safe(data: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k, v in data.items():
        if v is None:
            out[k] = None
        elif isinstance(v, Decimal):
            out[k] = float(v)
        elif isinstance(v, (datetime, date)):
            out[k] = v.isoformat()
        elif isinstance(v, dict):
            out[k] = json_safe(v)  # type: ignore[assignment]
        elif isinstance(v, list):
            out[k] = [_walk(x) for x in v]
        else:
            out[k] = _scalar(v)
    return out


def _scalar(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return v


def _walk(v: Any) -> Any:
    if isinstance(v, dict):
        return json_safe(v)
    if isinstance(v, list):
        return [_walk(x) for x in v]
    return _scalar(v)
