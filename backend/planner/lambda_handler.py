"""
Financial Planner Orchestrator Lambda Handler
"""

import os
import json
import time
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

try:
    from dotenv import load_dotenv

    load_dotenv(override=True)
except ImportError:
    pass

# OpenAI Agents SDK registers a default exporter to api.openai.com/v1/traces (expects OPENAI_API_KEY).
# AlexFin uses OpenRouter for models and Langfuse for traces — disable that exporter.
os.environ.setdefault("OPENAI_AGENTS_DISABLE_TRACING", "true")

from agents import trace

# Import database package
from src import Database

from agent import (
    PlannerContext,
    handle_missing_instruments,
    load_portfolio_summary,
    log_planner_child_lambda_env,
    orch_step,
    run_mandatory_child_lambdas,
)
from market import update_instrument_prices

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize database
db = Database()


def _is_sqs_trigger(event: Any) -> bool:
    return isinstance(event, dict) and bool(event.get("Records"))


def _lambda_success_response(event: Any, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    SQS + ReportBatchItemFailures: return partial-batch shape so Lambda ACKs the message.
    Direct / local invoke: keep API-style dict for tests and MOCK_LAMBDAS.
    """
    if _is_sqs_trigger(event):
        return {"batchItemFailures": []}
    return {"statusCode": 200, "body": json.dumps(body)}


def _parse_planner_event(event: Any) -> tuple[Dict[str, Any], str]:
    """Return (body_dict, job_id) from SQS or direct invocation."""
    if not isinstance(event, dict):
        return {}, ""
    records = event.get("Records")
    if records is not None:
        if not isinstance(records, list) or len(records) == 0:
            raise ValueError("Invalid SQS event: Records missing or empty")
        raw = records[0].get("body", "")
        if not isinstance(raw, str) or not raw.strip():
            raise ValueError("Invalid SQS message: body must be a non-empty string")
        raw_st = raw.strip()
        if not raw_st.startswith("{"):
            raise ValueError(
                "Invalid SQS message body: expected JSON object with job_id (strict SQS parse)"
            )
        try:
            body = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid SQS message body (not JSON): {e}") from e
        if not isinstance(body, dict):
            raise ValueError("Invalid SQS message body: root must be a JSON object")
        jid = body.get("job_id")
        if not jid:
            raise ValueError("Missing job_id in SQS message body")
        return body, str(jid)
    jid = event.get("job_id")
    if jid:
        return dict(event), str(jid)
    return {}, ""

def _job_age_seconds(job_row: Dict[str, Any]) -> Optional[float]:
    ca = job_row.get("created_at")
    if not ca or not isinstance(ca, str):
        return None
    try:
        s = ca.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - dt).total_seconds()
    except Exception:
        return None


async def run_orchestrator(job_id: str) -> list[str]:
    """Run tagger phase + mandatory child Lambdas (reporter/researcher, charter, retirement)."""
    t_run0 = time.perf_counter()
    try:
        # Update job status to running
        db.jobs.update_status(job_id, "running")
        orch_step(db, job_id, "planner", "running")

        log_planner_child_lambda_env()

        # Ensure instruments are classified via Tagger Lambda
        tagger_phase = await handle_missing_instruments(job_id, db)

        # Update instrument prices after tagging
        logger.info("Planner: Updating instrument prices from market data")
        await asyncio.to_thread(update_instrument_prices, job_id, db)

        # Load portfolio summary (just statistics, not full data)
        portfolio_summary = await asyncio.to_thread(load_portfolio_summary, job_id, db)

        ctx = PlannerContext(job_id=job_id, db=db)
        t_agent0 = time.perf_counter()
        with trace("Planner Agent"):
            agents_called = await run_mandatory_child_lambdas(
                ctx, portfolio_summary, tagger_phase=tagger_phase
            )

        orch_step(db, job_id, "planner", "completed")
        db.jobs.update_status(job_id, "completed")
        logger.info(
            json.dumps(
                {
                    "event": "planner_execution_agent_finished",
                    "job_id": job_id,
                    "agents_called": agents_called,
                    "tagger_phase": tagger_phase,
                    "runner_duration_ms": round(
                        (time.perf_counter() - t_agent0) * 1000.0, 2
                    ),
                    "total_duration_ms": round(
                        (time.perf_counter() - t_run0) * 1000.0, 2
                    ),
                },
                default=str,
            )
        )
        logger.info("Planner: Job %s completed successfully agents_called=%s", job_id, agents_called)
        return agents_called

    except Exception as e:
        logger.error(f"Planner: Error in orchestration: {e}", exc_info=True)
        try:
            orch_step(db, job_id, "planner", "failed", error=str(e)[:500])
        except Exception:
            logger.exception("Failed to record planner failure in orchestration metadata")
        db.jobs.update_status(job_id, "failed", error_message=str(e))
        logger.info(
            json.dumps(
                {
                    "event": "planner_execution_failed",
                    "job_id": job_id,
                    "error": str(e)[:500],
                    "total_duration_ms": round(
                        (time.perf_counter() - t_run0) * 1000.0, 2
                    ),
                },
                default=str,
            )
        )
        raise

def lambda_handler(event, context):
    """
    Lambda handler for SQS-triggered orchestration.

    Expected event from SQS:
    {
        "Records": [
            {
                "body": "job_id"
            }
        ]
    }
    """
    # SQS: Lambda treats invocation as SUCCESS unless an exception is raised — returning
    # statusCode 500 still deletes the message. On failure we RAISE after DB update.
    print("=== PLANNER INVOKED ===", flush=True)
    try:
        print(json.dumps(event, default=str)[:1000], flush=True)
    except (TypeError, ValueError, RecursionError):
        print(str(event)[:1000], flush=True)
    if isinstance(event, dict) and "Records" in event:
        recs = event.get("Records")
        if not isinstance(recs, list) or len(recs) == 0:
            raise ValueError("Invalid SQS event")
    print("=== PLANNER STARTED ===", flush=True)
    print(
        "LANGFUSE_PUBLIC_KEY set:",
        bool((os.getenv("LANGFUSE_PUBLIC_KEY") or "").strip()),
        "LANGFUSE_SECRET_KEY set:",
        bool((os.getenv("LANGFUSE_SECRET_KEY") or "").strip()),
        "AWS_LAMBDA_FUNCTION_NAME:",
        (os.getenv("AWS_LAMBDA_FUNCTION_NAME") or "").strip() or "(not set)",
        flush=True,
    )
    logger.info("PLANNER_LAMBDA_INVOKED event_type=%s", type(event).__name__)

    from alex_llm.lambda_observability import (
        log_lambda_agent_start,
        verbose_observability_enabled,
    )
    from alex_llm.tracing import normalize_trace_context, observe_agent, root_trace_context_from_seed

    body, job_id = _parse_planner_event(event)
    if not job_id:
        logger.error("No job_id found in event")
        raise ValueError("No job_id in event payload (SQS body must be JSON with job_id)")

    print("PLANNER_JOB_ID:", job_id, flush=True)
    logger.info("Planner Lambda invoked job_id=%s", job_id)
    sqs_rec = None
    if isinstance(event, dict) and event.get("Records"):
        r0 = event["Records"][0]
        sqs_rec = r0 if isinstance(r0, dict) else None

    log_lambda_agent_start(
        "planner",
        {**(body or {}), "job_id": job_id},
        context=context,
        received_from_sqs=bool(sqs_rec),
        sqs_record=sqs_rec,
    )

    logger.info(
        json.dumps(
            {
                "event": "job_received",
                "job_id": job_id,
                "source": "sqs" if sqs_rec else "direct",
                "aws_request_id": getattr(context, "aws_request_id", None),
            },
            default=str,
        )
    )
    if verbose_observability_enabled():
        try:
            print(
                "DEBUG full event:",
                json.dumps(event, default=str)[:240000],
                flush=True,
            )
        except (TypeError, ValueError):
            print("DEBUG full event:", str(event)[:240000], flush=True)

    job_row = db.jobs.find_by_id(job_id)
    if not job_row:
        raise RuntimeError(f"job not found: {job_id}")

    age_s = _job_age_seconds(job_row)
    if (
        job_row.get("status") == "pending"
        and age_s is not None
        and age_s > 60.0
    ):
        logger.warning(
            json.dumps(
                {
                    "event": "job_stale_pending_warning",
                    "job_id": job_id,
                    "age_seconds": round(age_s, 2),
                    "status": job_row.get("status"),
                    "hint": "Worker may not be consuming SQS or Lambda is failing before DB update",
                },
                default=str,
            )
        )

    clerk_user_id = (body.get("clerk_user_id") if body else None) or job_row.get(
        "clerk_user_id"
    )
    portfolio_id = None
    if clerk_user_id:
        try:
            acc = db.accounts.find_by_user(str(clerk_user_id))
            if acc:
                portfolio_id = str(acc[0]["id"])
        except Exception:
            logger.exception("Could not resolve portfolio_id for trace metadata")

    trace_id_raw = (body.get("trace_id") or "").strip() if body else ""
    tc = None
    if trace_id_raw:
        tc = root_trace_context_from_seed(trace_id_raw)
    elif body and body.get("trace_context"):
        tc = normalize_trace_context(body.get("trace_context"))

    # Re-read job row so idempotency matches DB (another worker may have finished).
    job_row = db.jobs.find_by_id(job_id)
    if not job_row:
        raise RuntimeError(f"job not found after metadata resolution: {job_id}")

    # Idempotency before tracing / work (duplicate SQS delivery).
    if job_row.get("status") in ("completed", "failed"):
        logger.info(
            json.dumps(
                {
                    "event": "job_duplicate_skip",
                    "job_id": job_id,
                    "terminal_status": job_row.get("status"),
                    "message": "idempotent_skip_duplicate_sqs_delivery",
                },
                default=str,
            )
        )
        logger.info(
            "Planner: Job %s already terminal (%s); skipping",
            job_id,
            job_row.get("status"),
        )
        # Langfuse: still emit a short span so duplicate deliveries are visible (not a silent gap).
        with observe_agent(
            service_name="alex_planner_worker",
            trace_context=tc,
            user_id=str(clerk_user_id) if clerk_user_id else None,
            job_id=str(job_id),
            portfolio_id=portfolio_id,
            root_span_name="planner_duplicate_skip",
            trace_input={
                "job_id": str(job_id),
                "terminal_status": job_row.get("status"),
            },
            extra_tags=["portfolio_analysis", "planner-worker", "idempotent_skip"],
        ):
            logger.info(
                "[JOB_ID=%s] [AGENT=planner] idempotent_skip duplicate SQS delivery",
                job_id,
            )
        return _lambda_success_response(
            event, {"success": True, "skipped": True, "job_id": str(job_id)}
        )

    # UI + ops: leave "pending" before Langfuse/agent work (observe_agent can no-op without keys).
    print("Planner: marking job running in DB job_id=", job_id, flush=True)
    db.jobs.update_status(str(job_id), "running")
    orch_step(db, str(job_id), "planner", "running")

    if isinstance(event, dict) and event.get("Records"):
        print("Parsed SQS body keys:", list(body.keys()) if body else [], flush=True)

    with observe_agent(
        service_name="alex_planner_worker",
        trace_context=tc,
        user_id=str(clerk_user_id) if clerk_user_id else None,
        job_id=str(job_id),
        portfolio_id=portfolio_id,
        root_span_name="planner",
        trace_input={"job_id": str(job_id)},
        extra_tags=["portfolio_analysis", "planner-worker"],
    ):
        try:
            os.environ["ALEX_JOB_ID"] = str(job_id)

            print("Running planner agent for job:", job_id, flush=True)
            logger.info("RUNNING_PLANNER_AGENT job_id=%s", job_id)
            agents_called = asyncio.run(run_orchestrator(job_id))

            out = {
                "success": True,
                "status": "completed",
                "message": f"Analysis completed for job {job_id}",
                "agents_called": agents_called,
            }
            print("PLANNER_RESULT:", json.dumps(out), flush=True)
            logger.info(
                "PLANNER_RESULT job_id=%s success=True agents_called=%s",
                job_id,
                agents_called,
            )
            return _lambda_success_response(event, out)

        except Exception as e:
            logger.error("Planner: Error in lambda handler: %s", e, exc_info=True)
            try:
                row = db.jobs.find_by_id(str(job_id))
                if row and row.get("status") not in ("completed", "failed"):
                    db.jobs.update_status(str(job_id), "failed", str(e)[:2000])
            except Exception:
                logger.exception(
                    "Planner: could not persist handler-level failure job_id=%s", job_id
                )
            err_body = {"success": False, "error": str(e)}
            print("PLANNER_RESULT:", json.dumps(err_body), flush=True)
            # Re-raise so SQS does NOT delete the message until success or maxReceiveCount → DLQ.
            # Preserve original exception type (do not wrap); wrapping broke observe_agent @contextmanager.
            raise

# For local testing
if __name__ == "__main__":
    # Define a test user
    test_user_id = "test_user_planner_local"

    # Ensure the test user exists before creating a job
    from src.schemas import UserCreate, JobCreate
    
    user = db.users.find_by_clerk_id(test_user_id)
    if not user:
        print(f"Creating test user: {test_user_id}")
        user_create = UserCreate(clerk_user_id=test_user_id, display_name="Test Planner User")
        db.users.create(user_create.model_dump(), returning='clerk_user_id')

    # Create a test job
    print("Creating test job...")
    job_create = JobCreate(
        clerk_user_id=test_user_id,
        job_type='portfolio_analysis',
        request_payload={
            'analysis_type': 'comprehensive',
            'test': True
        }
    )
    
    job = db.jobs.create(job_create.model_dump())
    job_id = job
    
    print(f"Created test job: {job_id}")
    
    # Test the handler
    test_event = {
        'job_id': job_id
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))