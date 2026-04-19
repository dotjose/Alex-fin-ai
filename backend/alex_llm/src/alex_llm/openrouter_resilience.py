"""
OpenRouter / LiteLLM failure classification.

Treats provider-level 503 and ``no healthy upstream`` as **non-retryable** outages so
callers do not spin Tenacity / manual loops. Rate limits remain retryable with tight caps.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Final

logger = logging.getLogger(__name__)

LLM_PROVIDER_UNAVAILABLE: Final = "LLM_PROVIDER_UNAVAILABLE"
LLM_ERROR: Final = "LLM_ERROR"

_NO_HEALTHY = "no healthy upstream"


def provider_unavailable_response(
    message: str | None = None,
    *,
    provider_hint: str | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "success": False,
        "error": LLM_PROVIDER_UNAVAILABLE,
        "message": message or "OpenRouter upstream unavailable",
    }
    if provider_hint:
        out["provider"] = provider_hint[:120]
    return out


def _walk_exception_chain(exc: BaseException) -> list[BaseException]:
    out: list[BaseException] = []
    seen: set[int] = set()
    cur: BaseException | None = exc
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        out.append(cur)
        cur = cur.__cause__ or cur.__context__
    return out


def _text_for_exc(exc: BaseException) -> str:
    parts = [f"{type(exc).__name__}: {exc!s}"]
    msg = getattr(exc, "message", None)
    if msg and str(msg) not in parts[0]:
        parts.append(str(msg))
    body = getattr(exc, "body", None)
    if body:
        parts.append(str(body))
    return " ".join(parts).lower()


def _parse_openrouter_provider_name(text: str) -> str | None:
    m = re.search(r'"provider_name"\s*:\s*"([^"]+)"', text)
    return m.group(1) if m else None


def exception_is_provider_unavailable(exc: BaseException) -> bool:
    """
    True when OpenRouter (or upstream) reports outage: 503 / no healthy upstream.

    These are **not** treated like transient blips; callers should fail fast or swap model.
    """
    for cur in _walk_exception_chain(exc):
        t = _text_for_exc(cur)
        if _NO_HEALTHY in t:
            return True
        if "openrouterexception" in t and "503" in t:
            return True
        if "503" in t and ("service unavailable" in t or "serviceunavailable" in t):
            return True
        if "httpstatuserror" in t and "503" in t:
            return True
        name = type(cur).__name__
        if name == "ServiceUnavailableError" or name.endswith("ServiceUnavailableError"):
            return True
        st = getattr(cur, "status_code", None)
        if st == 503:
            return True
    return False


def exception_is_litellm_rate_limit(exc: BaseException) -> bool:
    for cur in _walk_exception_chain(exc):
        if type(cur).__name__ == "RateLimitError":
            return True
        if "ratelimit" in type(cur).__name__.lower():
            return True
        t = _text_for_exc(cur)
        if "429" in t and "rate" in t:
            return True
    return False


def log_llm_provider_outage(
    exc: BaseException,
    *,
    agent: str,
    job_id: str | None,
    model: str | None,
) -> None:
    """Single structured log line (no retry spam); use exc_info=False."""
    raw = f"{type(exc).__name__}: {exc!s}"[:800]
    prov = _parse_openrouter_provider_name(raw) or _parse_openrouter_provider_name(_text_for_exc(exc))
    logger.error(
        "llm_provider_outage agent=%s job_id=%s model=%s provider=%s type=%s detail=%s",
        agent,
        job_id or "",
        (model or "")[:120],
        prov or "",
        type(exc).__name__,
        raw[:400],
    )


def short_llm_error_message(exc: BaseException, limit: int = 400) -> str:
    """Safe user-facing / API-facing snippet (no full httpx stack)."""
    if exception_is_provider_unavailable(exc):
        return "OpenRouter upstream unavailable"
    msg = f"{type(exc).__name__}: {exc!s}"
    return msg[:limit]


def result_is_provider_unavailable(result: Any) -> bool:
    return isinstance(result, dict) and result.get("error") == LLM_PROVIDER_UNAVAILABLE
