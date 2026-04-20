"""
Strict charts payload for jobs.charts_payload — validated, never raises to callers.
"""

from __future__ import annotations

import json
import logging
import math
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)


def empty_charts_payload() -> Dict[str, Any]:
    return {
        "allocation": {"type": "donut", "title": "Allocation", "data": []},
        "performance": {"type": "line", "title": "Performance", "data": []},
    }


def _clean_donut_rows(rows: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or row.get("label") or "").strip()
        if not name:
            continue
        raw = row.get("value")
        try:
            v = float(raw)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(v) or v < 0:
            continue
        out.append({"name": name[:120], "value": round(v, 2)})
    return out


def _clean_line_rows(rows: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, dict):
            continue
        d = str(row.get("date") or row.get("name") or row.get("label") or "").strip()
        if not d:
            continue
        raw = row.get("value")
        try:
            v = float(raw)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(v):
            continue
        out.append({"date": d[:64], "value": round(v, 2)})
    return out


def _normalize_chart_block(block: Any, *, kind: str) -> Dict[str, Any]:
    base_title = "Allocation" if kind == "allocation" else "Performance"
    if not isinstance(block, dict):
        return {
            "type": "donut" if kind == "allocation" else "line",
            "title": base_title,
            "data": [],
        }
    ctype = str(block.get("type") or ("donut" if kind == "allocation" else "line")).lower()
    if kind == "allocation" and ctype not in ("donut", "pie"):
        ctype = "donut"
    if kind == "performance" and ctype != "line":
        ctype = "line"
    title = str(block.get("title") or base_title)[:200]
    data = block.get("data")
    cleaned = _clean_donut_rows(data) if kind == "allocation" else _clean_line_rows(data)
    return {"type": ctype, "title": title, "data": cleaned}


def _ingest_legacy_charts_array(charts: Any, into: Dict[str, Any]) -> None:
    """Best-effort map legacy list charts into allocation/performance slots."""
    if not isinstance(charts, list):
        return
    alloc = into["allocation"]["data"]
    perf = into["performance"]["data"]
    for ch in charts:
        if not isinstance(ch, dict):
            continue
        ctype = str(ch.get("type") or "").lower()
        data = ch.get("data")
        if ctype in ("line", "area") and not perf:
            rows = _clean_line_rows(data)
            if rows:
                into["performance"] = {
                    "type": "line",
                    "title": str(ch.get("title") or "Performance")[:200],
                    "data": rows,
                }
        elif ctype in ("pie", "donut", "bar", "horizontalbar") and not alloc:
            rows = _clean_donut_rows(data)
            if rows:
                into["allocation"] = {
                    "type": "donut",
                    "title": str(ch.get("title") or "Allocation")[:200],
                    "data": rows,
                }


def normalize_and_validate_charts(
    parsed: Any,
    *,
    job_id: str,
    raw_llm_snippet: str | None = None,
) -> Tuple[Dict[str, Any], str | None]:
    """
    Return (charts_payload, optional_warning). Never raises.
    Always returns the two top-level keys allocation + performance.
    """
    warn: str | None = None
    base = empty_charts_payload()
    try:
        if not isinstance(parsed, dict):
            warn = "charter_parse_non_object"
            logger.warning(
                "chart_contract job_id=%s event=normalize_invalid_root snippet=%s",
                job_id,
                (raw_llm_snippet or "")[:400],
            )
            return base, warn

        if "allocation" in parsed or "performance" in parsed:
            if "allocation" in parsed:
                base["allocation"] = _normalize_chart_block(parsed.get("allocation"), kind="allocation")
            if "performance" in parsed:
                base["performance"] = _normalize_chart_block(parsed.get("performance"), kind="performance")

        if isinstance(parsed.get("charts"), list):
            _ingest_legacy_charts_array(parsed["charts"], base)

        if not base["allocation"]["data"] and not base["performance"]["data"]:
            warn = warn or "charter_no_series_after_normalize"
        logger.info(
            "chart_contract job_id=%s event=normalized allocation_pts=%s performance_pts=%s",
            job_id,
            len(base["allocation"]["data"]),
            len(base["performance"]["data"]),
        )
        return base, warn
    except Exception as e:
        logger.exception("chart_contract job_id=%s event=normalize_exception err=%s", job_id, e)
        return empty_charts_payload(), str(e)[:500]


def log_raw_charter_output(job_id: str, output: str | None) -> None:
    blob = output if isinstance(output, str) else ""
    max_len = 8000
    if len(blob) > max_len:
        blob = blob[:max_len] + "…(truncated)"
    logger.info(
        "charter_raw_llm job_id=%s chars=%s body=%s",
        job_id,
        len(output or ""),
        blob,
    )


def safe_json_parse(snippet: str) -> Any:
    try:
        return json.loads(snippet)
    except json.JSONDecodeError:
        return None
