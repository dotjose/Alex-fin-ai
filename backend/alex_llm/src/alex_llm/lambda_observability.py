"""
Lambda + SQS entry logging (JSON). No business logic — observability only.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def debug_agent_system_enabled() -> bool:
    v = (os.getenv("DEBUG_AGENT_SYSTEM") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def debug_agent_flow_enabled() -> bool:
    v = (os.getenv("DEBUG_AGENT_FLOW") or "").strip().lower()
    return v in ("1", "true", "yes", "on")


def verbose_observability_enabled() -> bool:
    return debug_agent_flow_enabled() or debug_agent_system_enabled()


def _json_line(payload: Dict[str, Any]) -> None:
    logger.info(json.dumps(payload, default=str))


def lambda_context_fields(context: Any) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if context is None:
        return out
    for attr in ("aws_request_id", "function_name", "function_version", "memory_limit_in_mb"):
        if hasattr(context, attr):
            try:
                out[attr] = getattr(context, attr)
            except Exception:
                pass
    if hasattr(context, "get_remaining_time_in_millis"):
        try:
            out["lambda_remaining_time_ms"] = int(context.get_remaining_time_in_millis())
        except Exception:
            pass
    return out


def sqs_record_diagnostics(record: Any) -> Dict[str, Any]:
    if not isinstance(record, dict):
        return {}
    attrs = record.get("attributes") or {}
    if not isinstance(attrs, dict):
        attrs = {}
    return {
        "message_id": record.get("messageId"),
        "receipt_handle_prefix": (
            (record.get("receiptHandle") or "")[:24] + "…"
            if record.get("receiptHandle") and not verbose_observability_enabled()
            else record.get("receiptHandle")
        ),
        "approximate_receive_count": attrs.get("ApproximateReceiveCount"),
        "approximate_first_receive_timestamp": attrs.get("ApproximateFirstReceiveTimestamp"),
        "sender_id": attrs.get("SenderId"),
        "sent_timestamp": attrs.get("SentTimestamp"),
    }


def env_sanity_flags(agent_name: str) -> Dict[str, Any]:
    """Presence-only (no secret values)."""
    keys = [
        "AWS_REGION",
        "AWS_DEFAULT_REGION",
        "SUPABASE_URL",
        "SUPABASE_DATABASE_URL",
        "OPENROUTER_API_KEY",
        "LANGFUSE_PUBLIC_KEY",
        "LANGFUSE_SECRET_KEY",
        "LANGFUSE_HOST",
        "OR_MODEL_REASONING",
        "OR_MODEL_FAST",
        "TAGGER_FUNCTION",
        "REPORTER_FUNCTION",
        "CHARTER_FUNCTION",
        "RETIREMENT_FUNCTION",
    ]
    out: Dict[str, Any] = {"agent": agent_name}
    for k in keys:
        v = os.getenv(k)
        out[k] = bool(v and str(v).strip())
    return out


def sanitize_event_for_log(event: Any, *, max_chars: int = 8000) -> Any:
    """Redact / shrink payload for logs unless DEBUG_AGENT_SYSTEM."""
    if verbose_observability_enabled():
        try:
            return json.loads(json.dumps(event, default=str))
        except (TypeError, ValueError):
            return str(event)[:200000]

    if not isinstance(event, dict):
        s = str(event)
        return s[:max_chars] if len(s) > max_chars else s

    ev = dict(event)
    if "Records" in ev and isinstance(ev["Records"], list):
        ev = dict(ev)
        recs = []
        for r in ev["Records"][:2]:
            if isinstance(r, dict):
                rr = dict(r)
                body = rr.get("body")
                if isinstance(body, str) and len(body) > 2000:
                    rr["body"] = body[:2000] + "…(truncated)"
                rh = rr.get("receiptHandle")
                if isinstance(rh, str) and len(rh) > 32:
                    rr["receiptHandle"] = rh[:24] + "…"
                recs.append(rr)
            else:
                recs.append(r)
        ev["Records"] = recs
    pd = ev.get("portfolio_data")
    if isinstance(pd, dict) and "accounts" in pd:
        pd = dict(pd)
        acct = pd.get("accounts")
        if isinstance(acct, list) and len(acct) > 2:
            pd["accounts"] = acct[:2] + [f"…+{len(acct) - 2} more"]
        ev["portfolio_data"] = pd
    raw = json.dumps(ev, default=str)
    if len(raw) > max_chars:
        return raw[:max_chars] + "…(truncated)"
    return ev


def log_lambda_agent_start(
    agent_name: str,
    event: Any,
    *,
    context: Any = None,
    received_from_sqs: bool = False,
    sqs_record: Optional[Dict[str, Any]] = None,
) -> None:
    job_id = None
    if isinstance(event, dict):
        job_id = event.get("job_id")

    payload: Dict[str, Any] = {
        "event": "lambda_agent_start",
        "banner": "=== AGENT START ===",
        "agent_name": agent_name,
        "job_id": job_id,
        "received_from_sqs": received_from_sqs,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_payload": sanitize_event_for_log(event),
        "lambda_context": lambda_context_fields(context),
        "env_sanity": env_sanity_flags(agent_name),
    }
    if sqs_record is not None:
        payload["sqs"] = sqs_record_diagnostics(sqs_record)
    _json_line(payload)
    print(f"=== AGENT START === agent={agent_name} job_id={job_id}", flush=True)
