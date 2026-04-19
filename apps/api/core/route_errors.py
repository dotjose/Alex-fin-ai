"""Map unexpected route exceptions to HTTP errors (no raw exception strings to clients)."""

from __future__ import annotations

import logging

from fastapi import HTTPException

logger = logging.getLogger(__name__)

_TRANSPORT_NAMES = frozenset(
    {
        "ConnectError",
        "ReadTimeout",
        "WriteTimeout",
        "ConnectTimeout",
        "RemoteProtocolError",
        "PoolTimeout",
        "ReadError",
        "WriteError",
        "TimeoutError",
        "OSError",
        "gaierror",
        "SSLError",
        "CertificateError",
    }
)


def is_likely_transport_error(exc: BaseException) -> bool:
    return type(exc).__name__ in _TRANSPORT_NAMES


def log_and_raise_http(
    log: logging.Logger,
    exc: BaseException,
    *,
    context: str,
    request_id: str | None = None,
) -> None:
    """Log full exception; raise HTTPException (never returns)."""
    rid = f" request_id={request_id}" if request_id else ""
    log.exception("%s failed%s: %s", context, rid, exc)
    if isinstance(exc, HTTPException):
        raise exc
    if is_likely_transport_error(exc):
        raise HTTPException(
            status_code=503,
            detail="Data service is temporarily unavailable.",
        ) from None
    raise HTTPException(
        status_code=500,
        detail="Request could not be completed.",
    ) from None
