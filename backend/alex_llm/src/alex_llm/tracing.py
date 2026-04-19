"""
Shared Langfuse + Logfire setup for all agent Lambdas (distributed trace_context support).
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import os
import time
from contextlib import contextmanager
from contextvars import ContextVar, Token
from typing import Any, Dict, Iterator, Optional

logger = logging.getLogger(__name__)

from alex_llm.lambda_observability import verbose_observability_enabled


def _flow_log(payload: Dict[str, Any]) -> None:
    """Structured one-line JSON for log aggregation (Datadog/CloudWatch)."""
    logger.info(json.dumps(payload, default=str))


def _trim_trace_input(val: Any, max_keys: int = 24, max_str: int = 500) -> Any:
    if verbose_observability_enabled():
        if val is None:
            return None
        if isinstance(val, dict):
            return dict(val)
        return val
    if val is None:
        return None
    if not isinstance(val, dict):
        s = str(val)
        return s[:max_str] if len(s) > max_str else s
    out: Dict[str, Any] = {}
    for i, (k, v) in enumerate(val.items()):
        if i >= max_keys:
            out["_truncated"] = True
            break
        ks = str(k)[:64]
        if isinstance(v, str):
            out[ks] = v[:max_str] if len(v) > max_str else v
        else:
            sv = str(v)
            out[ks] = sv[:max_str] if len(sv) > max_str else sv
    return out


_langfuse_constructed = False


def _langfuse_flush_best_effort(client: Any, *, timeout_s: float) -> None:
    """
    Langfuse ``flush()`` can block indefinitely (OTel force_flush + queue.join on
    score/media workers). Never block the planner/API past ``timeout_s``.
    """
    if timeout_s <= 0:
        return

    def _do_flush() -> None:
        client.flush()

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        fut = executor.submit(_do_flush)
        fut.result(timeout=timeout_s)
    except concurrent.futures.TimeoutError:
        logger.warning(
            "Langfuse flush exceeded %.1fs; continuing without waiting for export",
            timeout_s,
        )
        _flow_log(
            {
                "event": "langfuse_flush_timeout",
                "timeout_s": timeout_s,
            }
        )
    except Exception as e:
        logger.error("Langfuse flush failed: %s", e, exc_info=True)
        _flow_log(
            {
                "event": "langfuse_flush_error",
                "error": str(e)[:500],
            }
        )
    finally:
        try:
            executor.shutdown(wait=False, cancel_futures=False)
        except TypeError:
            # Python < 3.9 compatibility (unlikely; project is 3.12+)
            executor.shutdown(wait=False)


def ensure_langfuse_client_from_env() -> None:
    """
    Construct the Langfuse SDK client explicitly from env (Lambda-friendly).

    OpenAI Agents integration uses ``get_client()``; initializing ``Langfuse(...)``
    first ensures keys/host are honored in fresh Lambda cold starts.
    """
    global _langfuse_constructed
    if _langfuse_constructed:
        return
    pk = (os.getenv("LANGFUSE_PUBLIC_KEY") or "").strip()
    sk = (os.getenv("LANGFUSE_SECRET_KEY") or "").strip()
    if not pk or not sk:
        return
    host = (os.getenv("LANGFUSE_HOST") or "https://cloud.langfuse.com").strip().rstrip("/")
    try:
        from langfuse import Langfuse

        Langfuse(public_key=pk, secret_key=sk, host=host)
        _langfuse_constructed = True
    except Exception as e:
        logger.error("Langfuse explicit client init failed: %s", e, exc_info=True)


# OTel / Langfuse expect 16-hex span ids for synthetic parents when continuing an external trace.
_SYNTHETIC_PARENT_SPAN_ID = "0" * 16

_trace_link_var: ContextVar[Optional[Dict[str, str]]] = ContextVar(
    "alex_langfuse_trace_link", default=None
)


def new_trace_id_hex32() -> str:
    """Return a 32-char lowercase hex trace id (Langfuse / OTel wire format)."""
    import secrets

    return secrets.token_hex(16)


def normalize_trace_context(raw: Any) -> Optional[Dict[str, str]]:
    """
    Build Langfuse TraceContext dict from SQS/Lambda payload.
    Accepts {"trace_id": "...", "parent_span_id": "..."} or nested payloads.
    """
    if not raw or not isinstance(raw, dict):
        return None
    tid = raw.get("trace_id") or raw.get("traceId")
    pid = raw.get("parent_span_id") or raw.get("parentSpanId") or raw.get("parent_observation_id")
    if not tid or not isinstance(tid, str):
        return None
    tid = tid.strip().lower().replace("-", "")
    if len(tid) != 32 or any(c not in "0123456789abcdef" for c in tid):
        logger.warning("Invalid trace_id format from payload; ignoring trace_context")
        return None
    out: Dict[str, str] = {"trace_id": tid}
    if pid and isinstance(pid, str):
        pid = pid.strip().lower().replace("-", "")
        if len(pid) == 16 and all(c in "0123456789abcdef" for c in pid):
            out["parent_span_id"] = pid
    return out


def root_trace_context_from_seed(trace_id: str) -> Dict[str, str]:
    """Continue a trace started upstream (e.g. API) as the first real span in this process."""
    tid = trace_id.strip().lower().replace("-", "")
    return {"trace_id": tid, "parent_span_id": _SYNTHETIC_PARENT_SPAN_ID}


def current_trace_context_for_downstream() -> Optional[Dict[str, str]]:
    """
    Snapshot for Lambda.invoke Payload — links child agent spans under the active observation.
    """
    if not (os.getenv("LANGFUSE_PUBLIC_KEY") or "").strip():
        return None
    if not (os.getenv("LANGFUSE_SECRET_KEY") or "").strip():
        return None
    try:
        from langfuse import get_client

        lf = get_client()
        tid = lf.get_current_trace_id()
        pid = lf.get_current_observation_id()
        if not tid:
            link = _trace_link_var.get()
            if link and link.get("trace_id"):
                return dict(link)
            return None
        if not pid:
            pid = _SYNTHETIC_PARENT_SPAN_ID
        return {"trace_id": tid, "parent_span_id": pid}
    except Exception as e:
        if (os.getenv("LANGFUSE_PUBLIC_KEY") or "").strip() and (
            os.getenv("LANGFUSE_SECRET_KEY") or ""
        ).strip():
            logger.error(
                "Langfuse current_trace_context_for_downstream failed: %s",
                e,
                exc_info=True,
            )
            _flow_log(
                {
                    "event": "langfuse_trace_context_error",
                    "error": str(e)[:500],
                }
            )
        else:
            logger.debug("current_trace_context_for_downstream skipped: %s", e)
        return None


@contextmanager
def observe_agent(
    *,
    service_name: str = "alex-agent",
    trace_context: Optional[Dict[str, str]] = None,
    user_id: Optional[str] = None,
    job_id: Optional[str] = None,
    portfolio_id: Optional[str] = None,
    root_span_name: Optional[str] = None,
    flush_sleep_s: float = 0.35,
    trace_input: Optional[Dict[str, Any]] = None,
    extra_tags: Optional[list[str]] = None,
) -> Iterator[Any]:
    """
    Configure Langfuse for OpenAI Agents, optionally continuing a distributed trace.

    Logfire is optional: if ``logfire`` is not installed, Langfuse still runs (the old
    code imported logfire first and aborted all tracing when it was missing).

    Yields the Langfuse client (or None) so callers can score / events when supported.
    """
    has_lf = bool((os.getenv("LANGFUSE_SECRET_KEY") or "").strip()) and bool(
        (os.getenv("LANGFUSE_PUBLIC_KEY") or "").strip()
    )
    span_name = root_span_name or service_name
    if not has_lf:
        _flow_log(
            {
                "event": "agent_trace_fallback",
                "service_name": service_name,
                "agent_name": service_name,
                "step_name": span_name,
                "job_id": job_id,
                "langfuse_enabled": False,
                "input": _trim_trace_input(trace_input),
            }
        )
        _flow_log(
            {
                "event": "agent_started",
                "service_name": service_name,
                "step_name": span_name,
                "job_id": job_id,
                "langfuse_enabled": False,
            }
        )
        ok = False
        try:
            yield None
            ok = True
        finally:
            _flow_log(
                {
                    "event": "agent_completed" if ok else "agent_failed",
                    "service_name": service_name,
                    "step_name": span_name,
                    "job_id": job_id,
                    "langfuse_enabled": False,
                }
            )
        return

    ensure_langfuse_client_from_env()

    # Avoid Langfuse / OTel showing service.name=unknown_service when unset.
    if not (os.getenv("OTEL_SERVICE_NAME") or "").strip():
        os.environ["OTEL_SERVICE_NAME"] = "alexfin-agent"
    if not (
        (os.getenv("LANGFUSE_TRACING_ENVIRONMENT") or "").strip()
        or (os.getenv("LANGFUSE_TRACING_ENV") or "").strip()
    ):
        os.environ["LANGFUSE_TRACING_ENVIRONMENT"] = (
            (os.getenv("NODE_ENV") or "production").strip() or "production"
        )

    langfuse_client = None
    token: Optional[Token] = None

    # Only this import is a Langfuse "SDK missing" case — do not catch ImportError from user code
    # after ``yield`` (that causes ``generator didn't stop after throw()``).
    try:
        from langfuse import get_client
    except ImportError as e:
        logger.error("Langfuse SDK import failed (install langfuse): %s", e, exc_info=True)
        _flow_log(
            {
                "event": "agent_trace_fallback",
                "reason": "langfuse_import_error",
                "service_name": service_name,
                "step_name": span_name,
                "job_id": job_id,
                "langfuse_enabled": False,
                "error": str(e)[:500],
            }
        )
        ok = False
        try:
            yield None
            ok = True
        finally:
            _flow_log(
                {
                    "event": "agent_completed" if ok else "agent_failed",
                    "service_name": service_name,
                    "step_name": span_name,
                    "job_id": job_id,
                    "langfuse_enabled": False,
                }
            )
        return

    try:
        try:
            import logfire

            logfire.configure(service_name=service_name, send_to_logfire=False)
            logfire.instrument_openai_agents()
        except ImportError:
            logger.debug(
                "logfire not installed; Langfuse tracing still enabled "
                "(install logfire for optional OpenAI Agents ↔ logfire bridge)"
            )
        except Exception as e:
            logger.debug("logfire setup skipped: %s", e)

        langfuse_client = get_client()
        meta: Dict[str, str] = {}
        if job_id:
            meta["job_id"] = str(job_id)[:200]
        if user_id:
            meta["user_id"] = str(user_id)[:200]
        if portfolio_id:
            meta["portfolio_id"] = str(portfolio_id)[:200]
        meta["agent_name"] = service_name[:120]

        tc = trace_context
        if tc:
            tc = dict(tc)
            tc.setdefault("parent_span_id", _SYNTHETIC_PARENT_SPAN_ID)

        md_str: Dict[str, str] = {k: str(v) for k, v in meta.items() if v is not None}
        release = (os.getenv("LANGFUSE_RELEASE") or os.getenv("APP_VERSION") or "").strip() or None
        tags: list[str] = ["alex-ai", service_name.replace(" ", "-")[:48]]
        if extra_tags:
            tags.extend(str(t)[:64] for t in extra_tags if t)

        try:
            obs_cm = langfuse_client.start_as_current_observation(
                as_type="span",
                name=span_name,
                trace_context=tc,
                metadata=md_str or None,
            )
        except Exception as e:
            logger.error(
                "Langfuse start_as_current_observation failed (trace will not export): %s",
                e,
                exc_info=True,
            )
            _flow_log(
                {
                    "event": "agent_trace_fallback",
                    "reason": "start_observation_failed",
                    "service_name": service_name,
                    "step_name": span_name,
                    "job_id": job_id,
                    "langfuse_enabled": False,
                    "error": str(e)[:500],
                }
            )
            try:
                _langfuse_flush_best_effort(langfuse_client, timeout_s=3.0)
            except Exception as fe:
                logger.error("Langfuse flush after start_observation failure: %s", fe, exc_info=True)
            yield None
            return

        with obs_cm:
            link = {
                "trace_id": langfuse_client.get_current_trace_id() or "",
                "parent_span_id": langfuse_client.get_current_observation_id()
                or _SYNTHETIC_PARENT_SPAN_ID,
            }
            token = _trace_link_var.set(link)
            try:
                upd = getattr(langfuse_client, "update_current_trace", None)
                if callable(upd):
                    slug = str(span_name).replace(" ", "-").replace("_", "-").lower()
                    trace_display_name = f"alex-{slug}"[:120]
                    safe_input = trace_input
                    if safe_input is not None and not verbose_observability_enabled():
                        safe_input = {
                            str(k)[:64]: (v if isinstance(v, str) else str(v))[:500]
                            for k, v in safe_input.items()
                        }
                    upd(
                        name=trace_display_name,
                        user_id=str(user_id) if user_id else None,
                        session_id=str(job_id) if job_id else None,
                        version=release,
                        metadata=md_str,
                        tags=tags,
                        input=safe_input,
                    )
            except Exception as e:
                logger.error(
                    "Langfuse update_current_trace failed (trace may be incomplete): %s",
                    e,
                    exc_info=True,
                )
                _flow_log(
                    {
                        "event": "langfuse_update_trace_error",
                        "service_name": service_name,
                        "step_name": span_name,
                        "job_id": job_id,
                        "error": str(e)[:500],
                    }
                )
            if verbose_observability_enabled():
                _flow_log(
                    {
                        "event": "debug_langfuse_trace",
                        "service_name": service_name,
                        "step_name": span_name,
                        "job_id": job_id,
                        "trace_context_supplied": bool(trace_context),
                        "tags": tags[:20],
                    }
                )
            _flow_log(
                {
                    "event": "agent_started",
                    "service_name": service_name,
                    "step_name": span_name,
                    "job_id": job_id,
                    "langfuse_enabled": True,
                }
            )
            ok = False
            try:
                yield langfuse_client
                ok = True
            finally:
                lf_tid = None
                lf_oid = None
                try:
                    lf_tid = langfuse_client.get_current_trace_id()
                    lf_oid = langfuse_client.get_current_observation_id()
                except Exception:
                    pass
                _flow_log(
                    {
                        "event": "agent_completed" if ok else "agent_failed",
                        "service_name": service_name,
                        "step_name": span_name,
                        "job_id": job_id,
                        "langfuse_enabled": True,
                        "langfuse_trace_id": lf_tid,
                        "langfuse_observation_id": lf_oid,
                    }
                )

        if token is not None:
            try:
                _trace_link_var.reset(token)
            except ValueError:
                pass
            token = None
    finally:
        if token is not None:
            try:
                _trace_link_var.reset(token)
            except ValueError:
                pass
        if langfuse_client:
            try:
                # Never call shutdown() here: ``get_client()`` is a process-wide singleton;
                # shutdown tears down OTel exporters and background workers and can wedge
                # the next agent. Rely on Langfuse atexit / process exit for shutdown.
                flush_timeout = float(
                    (os.getenv("LANGFUSE_FLUSH_TIMEOUT_S") or "8.0").strip() or "8.0"
                )
                _langfuse_flush_best_effort(langfuse_client, timeout_s=flush_timeout)
                if flush_sleep_s and flush_sleep_s > 0:
                    time.sleep(flush_sleep_s)
            except Exception as e:
                logger.error("Langfuse post-agent cleanup failed: %s", e, exc_info=True)
                _flow_log(
                    {
                        "event": "langfuse_flush_error",
                        "error": str(e)[:500],
                    }
                )


def attach_trace_to_lambda_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Mutate-and-return payload with trace_context for downstream Lambda."""
    ctx = current_trace_context_for_downstream()
    if ctx:
        out = dict(payload)
        out["trace_context"] = ctx
        return out
    return payload
