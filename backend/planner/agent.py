"""
Financial Planner Orchestrator Agent - coordinates portfolio analysis across specialized agents.
"""

import asyncio
import json
import logging
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List, Optional

import boto3
from botocore.exceptions import ClientError
from agents import RunContextWrapper, function_tool

from alex_llm.llm import get_llm
from alex_llm.lambda_observability import verbose_observability_enabled
from alex_llm.openrouter_resilience import LLM_ERROR, LLM_PROVIDER_UNAVAILABLE
from alex_llm.tracing import attach_trace_to_lambda_payload, root_trace_context_from_seed

from child_agent_dispatch import run_child_lambda_handler_locally

logger = logging.getLogger()


def _orchestration_soft_llm_result(result: Any) -> bool:
    """Child returned a controlled LLM failure; planner should continue downstream steps."""
    if not isinstance(result, dict) or result.get("success") is not False:
        return False
    err = str(result.get("error") or "")
    return err in (LLM_PROVIDER_UNAVAILABLE, LLM_ERROR)


lambda_client = boto3.client(
    "lambda",
    region_name=os.environ.get("AWS_REGION")
    or os.environ.get("AWS_DEFAULT_REGION")
    or "us-east-1",
)

TAGGER_FUNCTION = os.getenv("TAGGER_FUNCTION", "alex-tagger")
REPORTER_FUNCTION = os.getenv("REPORTER_FUNCTION", "alex-reporter")
# Portfolio researcher (narrative); defaults to same Lambda as reporter when unset.
RESEARCHER_FUNCTION = os.getenv("RESEARCHER_FUNCTION") or REPORTER_FUNCTION
CHARTER_FUNCTION = os.getenv("CHARTER_FUNCTION", "alex-charter")
RETIREMENT_FUNCTION = os.getenv("RETIREMENT_FUNCTION", "alex-retirement")


def _redacted_environ_snapshot() -> Dict[str, str]:
    """Full environ for debugging with obvious secrets stripped (not cryptographic)."""
    out: Dict[str, str] = {}
    for k, v in os.environ.items():
        vs = v if isinstance(v, str) else str(v)
        ku = k.upper()
        if any(
            s in ku
            for s in (
                "SECRET",
                "PASSWORD",
                "TOKEN",
                "API_KEY",
                "ACCESS_KEY",
                "SERVICE_ROLE",
                "PRIVATE_KEY",
                "AUTHORIZATION",
                "LANGFUSE_PUBLIC",
                "LANGFUSE_SECRET",
                "DATABASE_URL",
                "POSTGRES",
                "JWT",
                "GIT_ASKPASS",
                "VSCODE_GIT_IPC_AUTH",
            )
        ):
            out[k] = "<redacted>" if vs else ""
        else:
            out[k] = vs
    return out


def log_planner_child_lambda_env() -> None:
    """Log child Lambda names + redacted ``os.environ`` (Step 4 / ops)."""
    snap = {
        "AGENT_EXECUTION_MODE": (os.getenv("AGENT_EXECUTION_MODE") or "local").strip(),
        "TAGGER_FUNCTION": TAGGER_FUNCTION,
        "REPORTER_FUNCTION": REPORTER_FUNCTION,
        "RESEARCHER_FUNCTION": RESEARCHER_FUNCTION,
        "CHARTER_FUNCTION": CHARTER_FUNCTION,
        "RETIREMENT_FUNCTION": RETIREMENT_FUNCTION,
        "AWS_REGION": os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "",
    }
    print("PLANNER_CHILD_LAMBDAS:", json.dumps(snap, default=str), flush=True)
    for k, v in snap.items():
        if k != "AWS_REGION" and not (str(v).strip()):
            logger.error("PLANNER_ENV_MISSING %s is empty — Terraform / env must set it", k)
    red_all = _redacted_environ_snapshot()
    planner_keys = (
        "AGENT_EXECUTION_MODE",
        "TAGGER_FUNCTION",
        "REPORTER_FUNCTION",
        "RESEARCHER_FUNCTION",
        "CHARTER_FUNCTION",
        "RETIREMENT_FUNCTION",
        "AWS_REGION",
        "AWS_DEFAULT_REGION",
    )
    env_compact = {k: red_all.get(k, "") for k in planner_keys}
    print("ENV:", json.dumps(dict(sorted(env_compact.items())), default=str), flush=True)
    if (os.getenv("ALEX_DEBUG_PLANNER_ENV") or "").strip().lower() in ("1", "true", "yes", "on"):
        try:
            env_blob = json.dumps(dict(sorted(red_all.items())), default=str)
        except (TypeError, ValueError):
            env_blob = str(sorted(os.environ.keys()))
        max_len = 62000
        if len(env_blob) > max_len:
            env_blob = env_blob[:max_len] + "…(truncated)"
        print("ENV_FULL_REDACTED:", env_blob, flush=True)


def _lambda_client_error_non_retryable(exc: BaseException) -> bool:
    """Permanent config / IAM / missing function — retries will not help."""
    if isinstance(exc, ClientError):
        code = (exc.response.get("Error") or {}).get("Code") or ""
        return code in (
            "ResourceNotFoundException",
            "AccessDeniedException",
            "UnrecognizedClientException",
            "InvalidSignatureException",
        )
    s = str(exc)
    return "ResourceNotFoundException" in s and "Function not found" in s


class _UseLocalChildFallback(Exception):
    """Boto reported a missing Lambda; planner may run the child's handler in-process."""

    __slots__ = ("original",)

    def __init__(self, original: BaseException):
        super().__init__(str(original))
        self.original = original


def get_agent_execution_mode() -> str:
    v = (os.getenv("AGENT_EXECUTION_MODE") or "local").strip().lower()
    if v not in ("local", "lambda"):
        raise ValueError(f"Invalid AGENT_EXECUTION_MODE: {v!r} (expected local or lambda)")
    return v


def _lambda_fallback_local_enabled() -> bool:
    return (os.getenv("AGENT_LAMBDA_FALLBACK_LOCAL", "true").strip().lower() in ("1", "true", "yes", "on"))


def _is_resource_not_found(exc: BaseException) -> bool:
    if isinstance(exc, ClientError):
        code = (exc.response.get("Error") or {}).get("Code") or ""
        return code == "ResourceNotFoundException"
    s = str(exc)
    return "ResourceNotFoundException" in s and "Function not found" in s


def _function_name_for_logical(logical_key: str) -> str:
    k = logical_key.strip().lower()
    if k == "tagger":
        return (TAGGER_FUNCTION or "").strip()
    if k == "researcher":
        return (RESEARCHER_FUNCTION or "").strip()
    if k == "reporter":
        return (REPORTER_FUNCTION or "").strip()
    if k == "charter":
        return (CHARTER_FUNCTION or "").strip()
    if k == "retirement":
        return (RETIREMENT_FUNCTION or "").strip()
    raise ValueError(f"Unknown agent: {logical_key!r}")


def _unwrap_agent_handler_payload(result: Any) -> Dict[str, Any]:
    """Normalize Lambda proxy responses and Lambda error envelopes into a flat dict."""
    if not isinstance(result, dict):
        return {"message": str(result)}
    if result.get("errorMessage"):
        return {
            "error": str(result.get("errorMessage")),
            "errorType": result.get("errorType"),
        }
    if "statusCode" in result and "body" in result:
        outer_sc = result.get("statusCode")
        body_val = result["body"]
        if isinstance(body_val, str):
            try:
                inner = json.loads(body_val)
            except json.JSONDecodeError:
                inner = {"message": body_val}
        else:
            inner = body_val
        inner_dict = inner if isinstance(inner, dict) else {"message": str(inner)}
        merged = inner_dict
        if isinstance(outer_sc, int) and outer_sc >= 400:
            merged = {**merged, "statusCode": outer_sc}
        result = merged
    out = result if isinstance(result, dict) else {"message": str(result)}
    fail = _lambda_invocation_failure_detail(out)
    if fail:
        return {**out, "error": fail}
    return out


@contextmanager
def _lf_child_invoke_span(span_name: str, *, job_id: str) -> Iterator[None]:
    """
    Nested Langfuse observation per child Lambda (Step 6).

    Langfuse Python v3 has no ``Langfuse().trace()``; use ``start_as_current_observation``
    (same tree as planner ``observe_agent``).

    **Never** ``yield`` from an ``except`` after the inner ``yield`` received a throw — that
    causes ``RuntimeError: generator didn't stop after throw()``.
    """
    pk = (os.getenv("LANGFUSE_PUBLIC_KEY") or "").strip()
    sk = (os.getenv("LANGFUSE_SECRET_KEY") or "").strip()
    if not pk or not sk:
        yield
        return
    from langfuse import get_client

    lf = get_client()
    try:
        obs_cm = lf.start_as_current_observation(
            as_type="span",
            name=span_name,
            metadata={"job_id": str(job_id), "layer": "planner_child_invoke"},
        )
    except Exception:
        logger.exception("langfuse child span %s could not start (continuing without span)", span_name)
        yield
        return

    with obs_cm:
        yield


@dataclass
class PlannerContext:
    """Context for planner agent tools."""

    job_id: str
    db: Any


def _hydrate_trace_from_job(payload: Dict[str, Any], job_id: str | None, db: Any | None) -> Dict[str, Any]:
    """
    If Langfuse did not attach a live trace_context, continue the API root trace using
    ``request_payload._orch.trace_id`` so child Lambdas join the same Langfuse tree.
    """
    out = dict(payload)
    if out.get("trace_context") or not job_id or db is None:
        return out
    try:
        row = db.jobs.find_by_id(str(job_id))
        if not row:
            return out
        orch = (row.get("request_payload") or {}).get("_orch") or {}
        tid = (orch.get("trace_id") or "").strip()
        if not tid:
            return out
        out["trace_context"] = root_trace_context_from_seed(tid)
        out.setdefault("trace_id", tid)
    except Exception:
        logger.exception("trace_hydrate_from_job_failed job_id=%s", job_id)
    return out


def _lambda_invocation_failure_detail(result: Any) -> Optional[str]:
    """Detect agent Lambda failures after API-proxy style unwrapping."""
    if not isinstance(result, dict):
        return "invalid_lambda_response"
    if result.get("success") is False and result.get("error") in (
        LLM_PROVIDER_UNAVAILABLE,
        LLM_ERROR,
    ):
        return None
    err = result.get("error")
    if err:
        return str(err)
    if result.get("success") is False:
        return str(
            result.get("message")
            or result.get("error")
            or result.get("detail")
            or "agent_reported_success_false"
        )
    sc = result.get("statusCode")
    if isinstance(sc, int) and sc >= 400:
        return str(
            result.get("message")
            or result.get("body")
            or result.get("error")
            or f"lambda_status_{sc}"
        )
    return None


def orch_step(db: Any, job_id: str, agent_key: str, status: str, **extra: Any) -> None:
    """Best-effort UI + ops metadata on ``jobs.request_payload._orch.pipeline``."""
    t0 = time.perf_counter()
    try:
        step: Dict[str, Any] = {
            "status": status,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        step.update({k: v for k, v in extra.items() if v is not None})
        db.jobs.merge_orch(job_id, pipeline={agent_key: step})
        logger.info(
            "orch_transition job_id=%s agent=%s status=%s merge_orch_ms=%.2f",
            job_id,
            agent_key,
            status,
            (time.perf_counter() - t0) * 1000.0,
        )
    except Exception:
        logger.exception(
            "orch_transition_failed job_id=%s agent=%s status=%s",
            job_id,
            agent_key,
            status,
        )


async def invoke_agent(
    logical_agent: str,
    payload: Dict[str, Any],
    *,
    pipeline_agent: str | None = None,
    db: Any | None = None,
    job_id: str | None = None,
) -> Dict[str, Any]:
    """
    Run a child agent either in-process (``AGENT_EXECUTION_MODE=local``) or via boto3 Lambda invoke.

    ``logical_agent`` is one of: tagger, researcher, reporter, charter, retirement.
    """
    logical_key = logical_agent.strip().lower()
    mode = get_agent_execution_mode()

    try:
        fn = _function_name_for_logical(logical_key)
    except ValueError as e:
        raise RuntimeError(f"Agent failed: {e}") from e

    if mode == "lambda" and not fn:
        raise ValueError(
            f"{logical_agent}: Lambda FunctionName is empty — set "
            f"TAGGER_FUNCTION / REPORTER_FUNCTION / RESEARCHER_FUNCTION / CHARTER_FUNCTION / "
            f"RETIREMENT_FUNCTION in env."
        )

    timeout_s = float(os.environ.get("AGENT_LAMBDA_TIMEOUT_S", "120") or "120")
    max_attempts = max(1, int(os.environ.get("AGENT_LAMBDA_MAX_ATTEMPTS", "3") or "3"))

    if pipeline_agent and db is not None and job_id:
        orch_step(db, job_id, pipeline_agent, "running")

    merged = _hydrate_trace_from_job(dict(payload), job_id, db)
    logger.info(
        "PLANNER_CHILD_INVOKE agent=%s transport_mode=%s function=%s job_id=%s "
        "has_trace_context=%s payload_keys=%s",
        logical_key,
        mode,
        fn if mode == "lambda" else "(in_process)",
        job_id or "",
        bool(merged.get("trace_context")),
        list(merged.keys()),
    )
    sent = attach_trace_to_lambda_payload(merged)

    async def _invoke_local() -> Dict[str, Any]:
        """In-process child handler (see ``child_agent_dispatch`` for START/DONE/FAIL logs)."""
        raw = await run_child_lambda_handler_locally(logical_key, sent)
        out = _unwrap_agent_handler_payload(raw)
        if _orchestration_soft_llm_result(out):
            if pipeline_agent and db is not None and job_id:
                orch_step(
                    db,
                    job_id,
                    pipeline_agent,
                    "failed",
                    error=str(out.get("error", "LLM"))[:120],
                )
            logger.error(
                "[AGENT DEGRADED] %s job_id=%s mode=local llm_error=%s",
                logical_key,
                job_id or "",
                out.get("error"),
            )
            return out
        fail = out.get("error") or _lambda_invocation_failure_detail(out)
        if fail:
            if pipeline_agent and db is not None and job_id:
                orch_step(db, job_id, pipeline_agent, "failed", error=str(fail)[:500])
            logger.error("[AGENT FAIL] %s job_id=%s mode=local err=%s", logical_key, job_id or "", fail)
            raise RuntimeError(f"Agent failed: {logical_key}: {fail}")
        if pipeline_agent and db is not None and job_id:
            orch_step(db, job_id, pipeline_agent, "completed")
        return out

    if mode == "local":
        return await _invoke_local()

    async def _boto_once(p: Dict[str, Any]) -> Dict[str, Any]:
        try:
            logger.info(
                "[AGENT START] %s job_id=%s mode=lambda function=%s",
                logical_key,
                job_id or "",
                fn,
            )
            print(f"Calling {logical_key}: {fn}", flush=True)
            logger.info(
                "Invoking %s Lambda: %s timeout_s=%s job_id=%s",
                logical_key,
                fn,
                timeout_s,
                job_id or "",
            )
            response = await asyncio.to_thread(
                lambda_client.invoke,
                FunctionName=fn,
                InvocationType="RequestResponse",
                Payload=json.dumps(p),
            )
            if verbose_observability_enabled():
                rmeta = response.get("ResponseMetadata") or {}
                logger.info(
                    json.dumps(
                        {
                            "event": "planner_lambda_invoke_metadata",
                            "agent_name": logical_key,
                            "function_name": fn,
                            "job_id": job_id,
                            "aws_request_id": rmeta.get("RequestId"),
                            "http_status_code": rmeta.get("HTTPStatusCode"),
                            "function_error": response.get("FunctionError"),
                            "status_code": response.get("StatusCode"),
                            "invoke_payload": p,
                        },
                        default=str,
                    )
                )
            raw = response["Payload"].read()
            result = json.loads(raw)
            return _unwrap_agent_handler_payload(result)
        except Exception as e:
            logger.error("Error invoking %s: %s", logical_key, e, exc_info=True)
            print(f"AGENT FAILED ({logical_key} transport): {e}", flush=True)
            raise

    last: Dict[str, Any] = {}
    try:
        for attempt in range(max_attempts):
            try:
                last = await asyncio.wait_for(_boto_once(sent), timeout=timeout_s)
            except asyncio.TimeoutError:
                last = {"error": f"{logical_key}_lambda_timeout_after_{timeout_s}s"}
                logger.error(
                    "%s Lambda timeout (attempt %s/%s)",
                    logical_key,
                    attempt + 1,
                    max_attempts,
                )
            except Exception as e:
                last = {"error": f"{logical_key}_invoke_exception: {e!s}"}
                logger.error(
                    "%s Lambda invoke raised (attempt %s/%s)",
                    logical_key,
                    attempt + 1,
                    max_attempts,
                    exc_info=True,
                )
                print(f"AGENT FAILED ({logical_key}): {e}", flush=True)
                if _lambda_client_error_non_retryable(e):
                    if _is_resource_not_found(e) and _lambda_fallback_local_enabled():
                        logger.warning(
                            "planner_child_lambda_missing function=%s agent=%s job_id=%s err=%s; "
                            "falling back to in-process handler (AGENT_LAMBDA_FALLBACK_LOCAL)",
                            fn,
                            logical_key,
                            job_id or "",
                            e,
                        )
                        raise _UseLocalChildFallback(e)
                    if pipeline_agent and db is not None and job_id:
                        orch_step(
                            db,
                            job_id,
                            pipeline_agent,
                            "failed",
                            error=str(e)[:500],
                        )
                    hint = (
                        f"{logical_key}: {e!s}. "
                        "Set child *FUNCTION names to deployed Lambdas, use AGENT_EXECUTION_MODE=local, "
                        "or enable AGENT_LAMBDA_FALLBACK_LOCAL when functions are absent."
                    )
                    raise RuntimeError(hint) from e

            if _orchestration_soft_llm_result(last):
                if pipeline_agent and db is not None and job_id:
                    orch_step(
                        db,
                        job_id,
                        pipeline_agent,
                        "failed",
                        error=str(last.get("error", "LLM"))[:120],
                    )
                logger.error(
                    "[AGENT DEGRADED] %s job_id=%s mode=lambda llm_error=%s",
                    logical_key,
                    job_id or "",
                    last.get("error"),
                )
                return last
            fail = last.get("error") or _lambda_invocation_failure_detail(last)
            if not fail:
                if pipeline_agent and db is not None and job_id:
                    orch_step(db, job_id, pipeline_agent, "completed")
                logger.info("[AGENT DONE] %s job_id=%s mode=lambda", logical_key, job_id or "")
                return last
            last = {**last, "error": fail}
            logger.warning(
                "%s Lambda attempt %s/%s failed: %s",
                logical_key,
                attempt + 1,
                max_attempts,
                fail,
            )

        if pipeline_agent and db is not None and job_id:
            orch_step(
                db,
                job_id,
                pipeline_agent,
                "failed",
                error=str(last.get("error", "unknown"))[:500],
            )
        err_msg = str(last.get("error", last))
        print(f"AGENT FAILED ({logical_key} final): {err_msg}", flush=True)
        logger.error(
            "[AGENT FAIL] %s job_id=%s mode=lambda err=%s",
            logical_key,
            job_id or "",
            err_msg,
        )
        raise RuntimeError(
            f"Agent failed: {logical_key} Lambda failed after {max_attempts} attempts: {err_msg}"
        )
    except _UseLocalChildFallback:
        return await _invoke_local()


async def handle_missing_instruments(job_id: str, db) -> List[str]:
    """
    Ensure instruments have allocation JSON; delegate to the Tagger Lambda (core agent).
    """
    logger.info("Planner: Checking for instruments missing allocation data...")

    job = db.jobs.find_by_id(job_id)
    if not job:
        raise ValueError(f"Job {job_id} not found (portfolio / job missing)")

    user_id = job["clerk_user_id"]
    accounts = db.accounts.find_by_user(user_id)

    missing = []
    for account in accounts:
        positions = db.positions.find_by_account(account["id"])
        for position in positions:
            instrument = db.instruments.find_by_symbol(position["symbol"])
            if instrument:
                has_allocations = bool(
                    instrument.get("allocation_regions")
                    and instrument.get("allocation_sectors")
                    and instrument.get("allocation_asset_class")
                )
                if not has_allocations:
                    missing.append(
                        {"symbol": position["symbol"], "name": instrument.get("name", "")}
                    )
            else:
                missing.append({"symbol": position["symbol"], "name": ""})

    if missing:
        print("=== INVOKING TAGGER ===", flush=True)
        logger.info("Planner: Invoking Tagger Lambda for %s instruments", len(missing))
        try:
            with _lf_child_invoke_span("invoke_tagger", job_id=str(job_id)):
                result = await invoke_agent(
                    "tagger",
                    {"instruments": missing, "job_id": job_id, "clerk_user_id": user_id},
                    pipeline_agent="tagger",
                    db=db,
                    job_id=job_id,
                )
        except Exception as e:
            print(f"AGENT FAILED (Tagger): {e}", flush=True)
            raise
        if _orchestration_soft_llm_result(result):
            logger.warning(
                "Planner: tagger LLM degraded job_id=%s err=%s — continuing pipeline",
                job_id,
                result.get("error"),
            )
            orch_step(
                db,
                job_id,
                "tagger",
                "failed",
                error=str(result.get("error", "LLM"))[:120],
            )
            return ["tagger_degraded"]
        if result.get("error"):
            logger.error("Tagger Lambda failed: %s", result["error"])
            raise RuntimeError(f"Tagger failed: {result['error']}")
        if result.get("errors"):
            logger.warning("Tagger completed with row errors: %s", result["errors"])
        return ["tagger"]
    print("=== INVOKING TAGGER ===", flush=True)
    logger.info("Planner: tagger no-op (nothing to tag); all instruments have allocation data")
    with _lf_child_invoke_span("invoke_tagger", job_id=str(job_id)):
        pass  # Langfuse span only when no Lambda call
    orch_step(db, job_id, "tagger", "completed", detail="skipped_no_missing_instruments")
    return ["tagger_skipped"]


def load_portfolio_summary(job_id: str, db) -> Dict[str, Any]:
    """Load basic portfolio summary statistics only."""
    try:
        job = db.jobs.find_by_id(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        user_id = job["clerk_user_id"]
        user = db.users.find_by_clerk_id(user_id)
        if not user:
            raise ValueError(f"User {user_id} not found")

        accounts = db.accounts.find_by_user(user_id)

        total_value = 0.0
        total_positions = 0
        total_cash = 0.0

        for account in accounts:
            total_cash += float(account.get("cash_balance", 0))
            positions = db.positions.find_by_account(account["id"])
            total_positions += len(positions)

            for position in positions:
                instrument = db.instruments.find_by_symbol(position["symbol"])
                if instrument and instrument.get("current_price"):
                    price = float(instrument["current_price"])
                    quantity = float(position["quantity"])
                    total_value += price * quantity

        total_value += total_cash

        return {
            "total_value": total_value,
            "num_accounts": len(accounts),
            "num_positions": total_positions,
            "years_until_retirement": user.get("years_until_retirement", 30),
            "target_retirement_income": float(user.get("target_retirement_income", 80000)),
        }

    except Exception as e:
        logger.error("Error loading portfolio summary: %s", e)
        raise


async def invoke_researcher_internal(ctx: PlannerContext) -> str:
    job = ctx.db.jobs.find_by_id(ctx.job_id)
    uid = (job or {}).get("clerk_user_id")
    logger.info("Planner: calling Researcher (job_id=%s function=%s)", ctx.job_id, RESEARCHER_FUNCTION)
    result = await invoke_agent(
        "researcher",
        {
            "job_id": ctx.job_id,
            "clerk_user_id": uid,
            "step_name": "researcher",
        },
        pipeline_agent="reporter",
        db=ctx.db,
        job_id=ctx.job_id,
    )
    if _orchestration_soft_llm_result(result):
        logger.warning(
            "Planner: researcher LLM degraded job_id=%s err=%s — continuing",
            ctx.job_id,
            result.get("error"),
        )
        return (
            "Researcher step skipped (LLM unavailable); downstream agents will still run."
        )
    fail = _lambda_invocation_failure_detail(result) or result.get("error")
    if fail:
        raise RuntimeError(f"Researcher failed: {fail}")
    return (
        "Researcher agent completed successfully. "
        "Portfolio research narrative has been generated and saved."
    )


async def invoke_reporter_internal(ctx: PlannerContext) -> str:
    job = ctx.db.jobs.find_by_id(ctx.job_id)
    uid = (job or {}).get("clerk_user_id")
    logger.info("Planner: calling Reporter (job_id=%s function=%s)", ctx.job_id, REPORTER_FUNCTION)
    result = await invoke_agent(
        "reporter",
        {
            "job_id": ctx.job_id,
            "clerk_user_id": uid,
            "step_name": "reporter",
        },
        pipeline_agent="reporter",
        db=ctx.db,
        job_id=ctx.job_id,
    )
    if _orchestration_soft_llm_result(result):
        logger.warning(
            "Planner: reporter LLM degraded job_id=%s err=%s — continuing",
            ctx.job_id,
            result.get("error"),
        )
        return "Reporter step skipped (LLM unavailable); downstream agents will still run."
    fail = _lambda_invocation_failure_detail(result) or result.get("error")
    if fail:
        raise RuntimeError(f"Reporter failed: {fail}")
    return "Reporter agent completed successfully. Portfolio analysis narrative has been generated and saved."


async def invoke_charter_internal(ctx: PlannerContext) -> str:
    job = ctx.db.jobs.find_by_id(ctx.job_id)
    uid = (job or {}).get("clerk_user_id")
    logger.info("Planner: calling Charter (job_id=%s function=%s)", ctx.job_id, CHARTER_FUNCTION)
    result = await invoke_agent(
        "charter",
        {"job_id": ctx.job_id, "clerk_user_id": uid},
        pipeline_agent="charter",
        db=ctx.db,
        job_id=ctx.job_id,
    )
    if _orchestration_soft_llm_result(result):
        logger.warning(
            "Planner: charter LLM degraded job_id=%s err=%s — continuing",
            ctx.job_id,
            result.get("error"),
        )
        return "Charter step skipped (LLM unavailable); retirement will still run."
    fail = _lambda_invocation_failure_detail(result) or result.get("error")
    if fail:
        raise RuntimeError(f"Charter failed: {fail}")
    return "Charter agent completed successfully. Portfolio visualizations have been created and saved."


async def invoke_retirement_internal(ctx: PlannerContext) -> str:
    job = ctx.db.jobs.find_by_id(ctx.job_id)
    uid = (job or {}).get("clerk_user_id")
    logger.info("Planner: calling Retirement (job_id=%s function=%s)", ctx.job_id, RETIREMENT_FUNCTION)
    result = await invoke_agent(
        "retirement",
        {"job_id": ctx.job_id, "clerk_user_id": uid},
        pipeline_agent="retirement",
        db=ctx.db,
        job_id=ctx.job_id,
    )
    if _orchestration_soft_llm_result(result):
        logger.warning(
            "Planner: retirement LLM degraded job_id=%s err=%s — finishing pipeline",
            ctx.job_id,
            result.get("error"),
        )
        return "Retirement step skipped (LLM unavailable); job will complete with partial results."
    fail = _lambda_invocation_failure_detail(result) or result.get("error")
    if fail:
        raise RuntimeError(f"Retirement failed: {fail}")
    return "Retirement agent completed successfully. Retirement projections have been calculated and saved."


async def run_mandatory_child_lambdas(
    ctx: PlannerContext,
    portfolio_summary: Dict[str, Any],
    *,
    tagger_phase: List[str],
) -> List[str]:
    """
    Always run narrative + charter + retirement Lambdas after the tagger phase.

    The previous LLM-only tool path often skipped invocations (instructions said to skip when
    same Lambda, few positions, etc.). Production requires these calls every time.
    """
    _ = tagger_phase  # e.g. ["tagger"] or ["tagger_skipped"] — already logged in handle_missing_instruments
    # Do not gate on num_positions: downstream Lambdas must still run (empty portfolio is valid input).

    same_narrative_lambda = RESEARCHER_FUNCTION.strip() == REPORTER_FUNCTION.strip()

    print("=== INVOKING REPORTER ===", flush=True)
    try:
        with _lf_child_invoke_span(
            "invoke_reporter" if same_narrative_lambda else "invoke_researcher",
            job_id=str(ctx.job_id),
        ):
            await invoke_researcher_internal(ctx)
    except Exception as e:
        print(f"AGENT FAILED (Researcher/Reporter narrative): {e}", flush=True)
        raise

    if not same_narrative_lambda:
        print("=== INVOKING REPORTER ===", flush=True)
        try:
            with _lf_child_invoke_span("invoke_reporter", job_id=str(ctx.job_id)):
                await invoke_reporter_internal(ctx)
        except Exception as e:
            print(f"AGENT FAILED (Reporter standalone): {e}", flush=True)
            raise

    print("=== INVOKING CHARTER ===", flush=True)
    try:
        with _lf_child_invoke_span("invoke_charter", job_id=str(ctx.job_id)):
            await invoke_charter_internal(ctx)
    except Exception as e:
        print(f"AGENT FAILED (Charter): {e}", flush=True)
        raise

    print("=== INVOKING RETIREMENT ===", flush=True)
    try:
        with _lf_child_invoke_span("invoke_retirement", job_id=str(ctx.job_id)):
            await invoke_retirement_internal(ctx)
    except Exception as e:
        print(f"AGENT FAILED (Retirement): {e}", flush=True)
        raise

    return ["tagger", "reporter", "charter", "retirement"]


@function_tool
async def invoke_researcher(wrapper: RunContextWrapper[PlannerContext]) -> str:
    """Invoke the Portfolio Researcher agent (narrative / analysis). Uses RESEARCHER_FUNCTION (defaults to reporter Lambda)."""
    return await invoke_researcher_internal(wrapper.context)


@function_tool
async def invoke_reporter(wrapper: RunContextWrapper[PlannerContext]) -> str:
    """Invoke the Report Writer agent to generate portfolio analysis narrative."""
    return await invoke_reporter_internal(wrapper.context)


@function_tool
async def invoke_charter(wrapper: RunContextWrapper[PlannerContext]) -> str:
    """Invoke the Chart Maker agent to create portfolio visualizations."""
    return await invoke_charter_internal(wrapper.context)


@function_tool
async def invoke_retirement(wrapper: RunContextWrapper[PlannerContext]) -> str:
    """Invoke the Retirement Specialist agent for retirement projections."""
    return await invoke_retirement_internal(wrapper.context)


def create_agent(job_id: str, portfolio_summary: Dict[str, Any], db):
    """Create the orchestrator agent with tools."""
    context = PlannerContext(job_id=job_id, db=db)
    model = get_llm("reasoning")
    tools = [
        invoke_researcher,
        invoke_reporter,
        invoke_charter,
        invoke_retirement,
    ]
    same_narrative_lambda = RESEARCHER_FUNCTION.strip() == REPORTER_FUNCTION.strip()
    extra = (
        " For narrative, call invoke_researcher first when positions > 0. "
        "Do not call invoke_reporter in the same job if it targets the same Lambda as the researcher."
        if same_narrative_lambda
        else " For narrative, prefer invoke_researcher first when positions > 0; use invoke_reporter if you need the separate report writer deployment."
    )
    task = f"""Job {job_id} has {portfolio_summary['num_positions']} positions.
Retirement: {portfolio_summary['years_until_retirement']} years.

Call the appropriate agents.{extra}"""
    return model, tools, task, context
