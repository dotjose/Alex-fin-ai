"""Best-effort connectivity checks at API startup (logs only; does not replace health probes)."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def log_startup_connectivity(settings) -> None:
    """Log Supabase REST reachability and optional SQS queue attributes."""
    try:
        from services.supabase_client import get_database

        _ = get_database().jobs.find_all(limit=1)
        logger.info("startup_check supabase_ok table=jobs")
    except Exception as e:
        logger.error("startup_check supabase_failed err=%s", e, exc_info=True)

    if getattr(settings, "mock_lambdas", False):
        logger.info("startup_check sqs_skipped reason=MOCK_LAMBDAS")
        return

    q = (getattr(settings, "sqs_queue_url", None) or "").strip()
    if not q:
        logger.info("startup_check sqs_skipped reason=no_SQS_QUEUE_URL")
        return

    try:
        from services.aws import get_sqs_client, log_sqs_url_vs_credentials

        log_sqs_url_vs_credentials(settings, q, context="startup_check")
        c = get_sqs_client(settings)
        c.get_queue_attributes(QueueUrl=q, AttributeNames=["ApproximateNumberOfMessages"])
        logger.info("startup_check sqs_ok queue_reachable=true")
    except Exception as e:
        logger.error(
            "startup_check sqs_failed err=%s (POST /api/analyze may fail until fixed)",
            e,
            exc_info=True,
        )
