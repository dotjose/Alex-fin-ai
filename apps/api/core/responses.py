"""Structured API errors (CloudWatch-friendly, stable JSON shape)."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


def get_trace_id(request: Request) -> str:
    existing = getattr(request.state, "trace_id", None)
    if isinstance(existing, str) and existing.strip():
        return existing.strip()
    for header in ("x-request-id", "X-Request-Id", "x-trace-id", "X-Trace-Id", "X-Amzn-Trace-Id"):
        v = request.headers.get(header)
        if v and str(v).strip():
            return str(v).strip()[:256]
    return uuid.uuid4().hex[:24]


def structured_error_json(
    *,
    request: Request,
    message: str,
    code: str,
    status_code: int,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "error": message,
        "code": code,
        "trace_id": get_trace_id(request),
    }
    if extra:
        body.update(extra)
    return body


def structured_error_response(
    *,
    request: Request,
    message: str,
    code: str,
    status_code: int,
    extra: dict[str, Any] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=structured_error_json(
            request=request,
            message=message,
            code=code,
            status_code=status_code,
            extra=extra,
        ),
    )
