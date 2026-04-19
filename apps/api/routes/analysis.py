"""Analysis jobs + SQS enqueue."""

from __future__ import annotations

import json
import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Dict
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field

from core.auth import current_user_id_factory
from core.config import Settings
from core.route_errors import log_and_raise_http
from services.aws import credential_source_hint, get_sqs_client, log_sqs_url_vs_credentials
from services.supabase_client import get_database

from alex_llm.lambda_observability import verbose_observability_enabled
from alex_llm.tracing import observe_agent, root_trace_context_from_seed

logger = logging.getLogger(__name__)


def _job_flow_log(event: str, **fields: Any) -> None:
    logger.info(json.dumps({"event": event, **fields}, default=str))


def _run_planner_worker_sync(body: dict[str, Any]) -> None:
    """Same code path as SQS Lambda (sync), for MOCK_LAMBDAS / local debugging."""
    jid = str((body or {}).get("job_id") or "")
    try:
        from planner_entry import handler

        event = {"Records": [{"body": json.dumps(body)}]}
        logger.info("MOCK_LAMBDAS: invoking planner handler job_id=%s", jid or "?")
        result = handler(event, None)
        logger.info(
            "MOCK_LAMBDAS: planner handler finished job_id=%s result_keys=%s",
            jid or "?",
            list((result or {}).keys()),
        )
    except Exception as e:
        logger.exception("MOCK_LAMBDAS: planner worker crashed job_id=%s", jid or "?")
        if jid:
            try:
                get_database().jobs.update_status(
                    jid, "failed", f"mock_planner_crash: {e!s}"[:2000]
                )
            except Exception:
                logger.exception(
                    "MOCK_LAMBDAS: could not mark job failed job_id=%s", jid
                )


class AnalyzeRequest(BaseModel):
    analysis_type: str = Field(default="portfolio")
    options: Dict[str, Any] = Field(default_factory=dict)


class AnalyzeResponse(BaseModel):
    job_id: str
    message: str


class CapabilitiesResponse(BaseModel):
    """Non-secret flags for UI (e.g. disable Run analysis when queue is absent)."""

    analyze_enabled: bool
    node_env: str
    mock_lambdas: bool


def build_router(settings: Settings) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["analysis"])
    get_uid = current_user_id_factory(settings)
    db = get_database()
    sqs_client = (
        get_sqs_client(settings) if (settings.sqs_queue_url or "").strip() else None
    )
    _q = (settings.sqs_queue_url or "").strip()
    if _q:
        host = urlparse(_q).netloc or "(parse error)"
        redacted = _q if len(_q) < 24 else f"{_q[:20]}…"
        logger.info(
            "SQS startup: queue_url=%s host=%s region=%s credential_source=%s",
            redacted,
            host,
            (settings.aws_region or "").strip() or "us-east-1",
            credential_source_hint(settings),
        )
    else:
        logger.info(
            "SQS startup: SQS_QUEUE_URL unset — POST /api/analyze disabled; "
            "local dev runs without a queue."
        )

    @router.get("/capabilities", response_model=CapabilitiesResponse)
    async def capabilities():
        q = (settings.sqs_queue_url or "").strip()
        mock = bool(settings.mock_lambdas)
        dev_no_queue = (settings.node_env == "development" and not q) or (
            bool(settings.local_dev) and not q
        )
        effective_mock = mock or dev_no_queue
        return CapabilitiesResponse(
            analyze_enabled=bool(q) or effective_mock,
            node_env=settings.node_env,
            mock_lambdas=effective_mock,
        )

    @router.post("/analyze", response_model=AnalyzeResponse)
    async def trigger_analysis(
        request: AnalyzeRequest,
        background_tasks: BackgroundTasks,
        clerk_user_id: str = Depends(get_uid),
    ):
        try:
            _job_flow_log(
                "api_request",
                endpoint="POST /api/analyze",
                user_id=clerk_user_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
                payload_size=len(request.model_dump_json()),
                analysis_type=request.analysis_type,
            )
            queue_url = (settings.sqs_queue_url or "").strip()
            use_mock = bool(settings.mock_lambdas)
            if not queue_url and (
                settings.node_env == "development" or bool(settings.local_dev)
            ):
                use_mock = True
                logger.info(
                    "[JOB_ID=—] [AGENT=api] LOCAL_DEV: SQS_QUEUE_URL unset — "
                    "running planner in-process (development or LOCAL_DEV=true)"
                )
            if not use_mock and not queue_url:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Job queue is not configured (SQS_QUEUE_URL). "
                        "Set it to your SQS queue URL (e.g. from `terraform output -raw sqs_queue_url`) "
                        "so POST /api/analyze can enqueue work for the planner worker, "
                        "or set MOCK_LAMBDAS=true for in-process planner (local debugging)."
                    ),
                )
            if use_mock and not queue_url:
                logger.info(
                    "POST /api/analyze: in-process planner (MOCK_LAMBDAS or development without SQS_QUEUE_URL)"
                )
            elif use_mock and queue_url:
                logger.warning(
                    "MOCK_LAMBDAS=true: skipping SQS send despite SQS_QUEUE_URL being set "
                    "(in-process planner only)"
                )

            user = db.users.find_by_clerk_id(clerk_user_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            job_id = db.jobs.create_job(
                clerk_user_id=clerk_user_id,
                job_type="portfolio_analysis",
                request_payload=request.model_dump(),
            )
            _job_flow_log(
                "job_created",
                job_id=str(job_id),
                clerk_user_id=clerk_user_id,
                job_type="portfolio_analysis",
            )
            logger.info(
                "[JOB_ID=%s] [AGENT=api] job_created; starting enqueue / in-process flow",
                job_id,
            )
            trace_id = secrets.token_hex(16)
            now = datetime.now(timezone.utc).isoformat()
            agents = ("planner", "tagger", "reporter", "charter", "retirement")
            tc = root_trace_context_from_seed(trace_id)
            flush_s = float(os.getenv("LANGFUSE_API_FLUSH_SLEEP_S", "0.35") or "0.35")
            with observe_agent(
                service_name="alex_finance_api",
                trace_context=tc,
                user_id=clerk_user_id,
                job_id=str(job_id),
                root_span_name="enqueue_portfolio_analysis",
                flush_sleep_s=flush_s,
                trace_input={
                    "analysis_type": request.analysis_type,
                    "job_id": str(job_id),
                },
                extra_tags=["portfolio_analysis", "api"],
            ):
                db.jobs.merge_orch(
                    str(job_id),
                    trace_id=trace_id,
                    pipeline={a: {"status": "pending", "at": None} for a in agents},
                )
                db.jobs.merge_orch(
                    str(job_id),
                    pipeline={"planner": {"status": "queued", "at": now}},
                )
                body = {
                    "job_id": str(job_id),
                    "clerk_user_id": clerk_user_id,
                    "analysis_type": request.analysis_type,
                    "options": request.options,
                    "trace_id": trace_id,
                }
                _job_flow_log(
                    "sqs_enqueue_prepare",
                    job_id=str(job_id),
                    user_id=clerk_user_id,
                    trace_id=trace_id,
                    agent_triggered="planner",
                    message_body=body if verbose_observability_enabled() else None,
                    message_body_keys=list(body.keys()),
                )
                if use_mock:
                    logger.info(
                        "trigger_analysis: enqueue MOCK in-process job_id=%s trace_id=%s",
                        job_id,
                        trace_id,
                    )
                    background_tasks.add_task(_run_planner_worker_sync, body)
                    _job_flow_log(
                        "job_enqueued",
                        job_id=str(job_id),
                        transport="mock_in_process",
                    )
                    return AnalyzeResponse(
                        job_id=str(job_id),
                        message="Analysis started (MOCK_LAMBDAS in-process worker).",
                    )

                qh = urlparse(queue_url).netloc or "(invalid-url)"
                log_sqs_url_vs_credentials(
                    settings, queue_url, context="trigger_analysis"
                )
                logger.info(
                    "trigger_analysis: sending SQS job_id=%s queue_host=%s region=%s body_keys=%s",
                    job_id,
                    qh,
                    (settings.aws_region or "").strip() or "us-east-1",
                    list(body.keys()),
                )
                try:
                    if sqs_client is None:
                        raise HTTPException(
                            status_code=503,
                            detail="Job queue is not configured (SQS_QUEUE_URL).",
                        )
                    send_resp = sqs_client.send_message(
                        QueueUrl=queue_url, MessageBody=json.dumps(body)
                    )
                except Exception as send_err:
                    logger.exception("SQS send_message failed for job %s", job_id)
                    db.jobs.update_status(
                        job_id, "failed", f"enqueue_failed: {send_err!s}"[:2000]
                    )
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            "Could not enqueue the analysis job. "
                            "Verify SQS_QUEUE_URL, AWS credentials/region, and IAM permissions for sqs:SendMessage."
                        ),
                    ) from send_err

                logger.info(
                    "trigger_analysis: SQS send_message ok job_id=%s MessageId=%s",
                    job_id,
                    send_resp.get("MessageId"),
                )
                rmeta = send_resp.get("ResponseMetadata") or {}
                _job_flow_log(
                    "job_enqueued",
                    job_id=str(job_id),
                    message_id=send_resp.get("MessageId"),
                    queue_host=qh,
                    queue_url=queue_url if verbose_observability_enabled() else qh,
                    aws_request_id=rmeta.get("RequestId"),
                    http_status_code=rmeta.get("HTTPStatusCode"),
                    agent_triggered="planner",
                    message_body=body if verbose_observability_enabled() else None,
                )
                return AnalyzeResponse(
                    job_id=str(job_id),
                    message="Analysis started. Check job status for results.",
                )
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="POST /api/analyze")

    @router.get("/jobs/{job_id}")
    async def get_job_status(job_id: str, clerk_user_id: str = Depends(get_uid)):
        try:
            job = db.jobs.find_by_id(job_id)
            if not job:
                raise HTTPException(status_code=404, detail="Job not found")
            if job.get("clerk_user_id") != clerk_user_id:
                raise HTTPException(status_code=403, detail="Not authorized")
            orch = (job.get("request_payload") or {}).get("_orch") or {}
            _job_flow_log(
                "api_request",
                endpoint="GET /api/jobs/{job_id}",
                user_id=clerk_user_id,
                job_id=job_id,
                job_status=job.get("status"),
                trace_id=orch.get("trace_id"),
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            return jsonable_encoder(job)
        except HTTPException:
            raise
        except Exception as e:
            log_and_raise_http(logger, e, context="GET /api/jobs/{job_id}")

    @router.get("/jobs")
    async def list_jobs(clerk_user_id: str = Depends(get_uid)):
        try:
            user_jobs = db.jobs.find_by_user(clerk_user_id, limit=100)
            user_jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return jsonable_encoder({"jobs": user_jobs})
        except Exception as e:
            log_and_raise_http(logger, e, context="GET /api/jobs")

    return router
