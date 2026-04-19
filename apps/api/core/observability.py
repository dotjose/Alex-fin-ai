"""Langfuse + OpenAI Agents instrumentation (do not break existing flush semantics)."""

from __future__ import annotations

import logging
import os
from contextlib import contextmanager

logger = logging.getLogger(__name__)


@contextmanager
def observe_langfuse():
    """
    Optional Langfuse root span for short-lived API work (same pattern as ``alex_llm.tracing.observe_agent``).

    Requires both public and secret keys; uses a short post-flush sleep suitable for HTTP (not Lambdas).
    Prefer wrapping specific routes (e.g. ``POST /api/analyze``) with ``observe_agent`` when you need
    a distributed trace id; use this helper for generic API spans.
    """
    pk = (os.getenv("LANGFUSE_PUBLIC_KEY") or "").strip()
    sk = (os.getenv("LANGFUSE_SECRET_KEY") or "").strip()
    if not pk or not sk:
        yield
        return

    from alex_llm.tracing import observe_agent

    flush_s = float(os.getenv("LANGFUSE_API_FLUSH_SLEEP_S", "0.25") or "0.25")
    with observe_agent(
        service_name="alex_finance_api",
        root_span_name="api_request",
        flush_sleep_s=flush_s,
        extra_tags=["api"],
    ):
        yield
