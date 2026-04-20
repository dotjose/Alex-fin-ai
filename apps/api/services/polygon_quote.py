"""Best-effort live quotes via Polygon REST (no polygon-api-client dependency)."""

from __future__ import annotations

import logging
import time
import httpx

logger = logging.getLogger(__name__)

_OK_CACHE: dict[str, tuple[float, float]] = {}
_TTL_SEC = 60.0


def fetch_last_price(symbol: str, api_key: str) -> tuple[float | None, str]:
    """
    Returns (price, status).
    status: 'ok' | 'price_unavailable' | 'not_configured'
    Caller must treat None price as missing — never substitute a fake mark.
    """
    sym = symbol.strip().upper()
    if not sym:
        return None, "price_unavailable"

    if not api_key.strip():
        logger.debug("polygon_quote skipped symbol=%s reason=no_api_key", sym)
        return None, "not_configured"

    now = time.monotonic()
    hit = _OK_CACHE.get(sym)
    if hit and now < hit[1]:
        return hit[0], "ok"

    url = f"https://api.polygon.io/v2/aggs/ticker/{sym}/prev"
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(url, params={"adjusted": "true", "apiKey": api_key.strip()})
            if r.status_code != 200:
                logger.warning(
                    "polygon_quote http_error symbol=%s status=%s",
                    sym,
                    r.status_code,
                )
                return None, "price_unavailable"
            data = r.json()
            results = data.get("results") or data.get("Results")
            if not results:
                return None, "price_unavailable"
            bar = results[0] if isinstance(results, list) else results
            close = bar.get("c")
            if close is None:
                return None, "price_unavailable"
            price = float(close)
            if price <= 0 or price != price:
                return None, "price_unavailable"
            _OK_CACHE[sym] = (price, now + _TTL_SEC)
            return price, "ok"
    except Exception:
        logger.exception("polygon_quote exception symbol=%s", sym)
        return None, "price_unavailable"
