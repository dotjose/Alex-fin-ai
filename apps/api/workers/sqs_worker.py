"""SQS-triggered Lambda entry (delegates to bundled planner). Minimal logs only."""

from __future__ import annotations

import json
import logging

from planner_entry import handler as _planner_handler

logger = logging.getLogger(__name__)

__all__ = ["handler"]


def handler(event, context):
    """AWS Lambda invokes this for SQS → worker; keep planner logic unchanged."""
    recs = event.get("Records") if isinstance(event, dict) else None
    n = len(recs) if isinstance(recs, list) else 0
    first = recs[0] if n and isinstance(recs[0], dict) else {}
    attrs = first.get("attributes") if isinstance(first, dict) else {}
    if not isinstance(attrs, dict):
        attrs = {}
    logger.info(
        json.dumps(
            {
                "event": "sqs_worker_invoked",
                "record_count": n,
                "message_id": first.get("messageId"),
                "approximate_receive_count": attrs.get("ApproximateReceiveCount"),
                "aws_request_id": getattr(context, "aws_request_id", None),
            },
            default=str,
        )
    )
    out = _planner_handler(event, context)
    logger.info(
        json.dumps(
            {
                "event": "sqs_worker_returning",
                "aws_request_id": getattr(context, "aws_request_id", None),
                "response_keys": list(out.keys()) if isinstance(out, dict) else type(out).__name__,
            },
            default=str,
        )
    )
    return out
