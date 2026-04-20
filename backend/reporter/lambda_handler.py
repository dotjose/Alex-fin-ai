"""
Report Writer Agent Lambda Handler
"""

import os
import sys
import json
import asyncio
import logging
import time
from typing import Dict, Any
from datetime import datetime

try:
    from dotenv import load_dotenv

    load_dotenv(override=True)
except ImportError:
    pass

# Sibling imports (``judge``, ``templates``, ``agent``) resolve when this file is
# loaded via importlib with ``/var/task/reporter`` on ``sys.path``, or when loaded
# as ``reporter.lambda_handler`` (add this directory so local imports succeed).
_REPORTER_DIR = os.path.dirname(os.path.abspath(__file__))
if _REPORTER_DIR not in sys.path:
    sys.path.insert(0, _REPORTER_DIR)

# OpenRouter + Langfuse stack: disable OpenAI-hosted Agents trace export (expects OPENAI_API_KEY).
os.environ.setdefault("OPENAI_AGENTS_DISABLE_TRACING", "true")

from agents import Agent, Runner, trace
from judge import evaluate

GUARD_AGAINST_SCORE = 0.3  # Guard against score being too low

# Import database package
from src import Database

from templates import REPORTER_INSTRUCTIONS
from agent import create_agent, ReporterContext
from alex_llm.lambda_observability import log_lambda_agent_start
from alex_llm.llm import openrouter_fallback_slug
from alex_llm.openrouter_resilience import (
    LLM_ERROR,
    exception_is_litellm_rate_limit,
    exception_is_provider_unavailable,
    log_llm_provider_outage,
    provider_unavailable_response,
    short_llm_error_message,
)
from alex_llm.tracing import normalize_trace_context, observe_agent

logger = logging.getLogger()
logger.setLevel(logging.INFO)


async def _reporter_run_with_model_slug(
    job_id: str,
    portfolio_data: Dict[str, Any],
    user_data: Dict[str, Any],
    db,
    observability,
    *,
    model_slug: str | None,
) -> Dict[str, Any]:
    """Single LLM pass + judge + DB write (no outer retry)."""
    model, tools, task, context = create_agent(
        job_id, portfolio_data, user_data, db, model_slug=model_slug
    )
    model_label = model_slug or str(getattr(model, "model", type(model).__name__))[:200]
    logger.info(
        json.dumps(
            {
                "event": "reporter_llm_ready",
                "job_id": job_id,
                "model": model_label,
                "tools_count": len(tools) if tools is not None else 0,
            },
            default=str,
        )
    )

    with trace("Reporter Agent"):
        agent = Agent[ReporterContext](
            name="Report Writer", instructions=REPORTER_INSTRUCTIONS, model=model, tools=tools
        )

        result = await Runner.run(
            agent,
            input=task,
            context=context,
            max_turns=10,
        )

        response = result.final_output

        if observability:
            with observability.start_as_current_observation(
                as_type="span",
                name="judge",
            ) as span:
                evaluation = await evaluate(REPORTER_INSTRUCTIONS, task, response)
                score = evaluation.score / 100
                comment = evaluation.feedback
                span.score(name="Judge", value=score, data_type="NUMERIC", comment=comment)
                observation = f"Score: {score} - Feedback: {comment}"
                observability.create_event(name="Judge Event", status_message=observation)
                if score < GUARD_AGAINST_SCORE:
                    logger.error(f"Reporter score is too low: {score}")
                    response = "I'm sorry, I'm not able to generate a report for you. Please try again later."

        report_payload = {
            "content": response,
            "generated_at": datetime.utcnow().isoformat(),
            "agent": "reporter",
        }

        success = db.jobs.update_report(job_id, report_payload)

        if not success:
            logger.error(f"Failed to save report for job {job_id}")

        return {
            "success": success,
            "message": "Report generated and stored"
            if success
            else "Report generated but failed to save",
            "final_output": result.final_output,
        }


async def run_reporter_agent(
    job_id: str,
    portfolio_data: Dict[str, Any],
    user_data: Dict[str, Any],
    db=None,
    observability=None,
) -> Dict[str, Any]:
    """
    Run the reporter with bounded rate-limit retries only (no retries on 503 / no healthy upstream).

    On provider outage: optional ``OR_MODEL_REASONING_FALLBACK`` / ``OR_MODEL_FALLBACK`` then
    structured ``LLM_PROVIDER_UNAVAILABLE`` payload (no raw stack in return value).
    """
    fb_slug = openrouter_fallback_slug("reasoning")
    slugs_to_try: list[str | None] = [None]
    if fb_slug:
        slugs_to_try.append(fb_slug)

    last_exc: BaseException | None = None
    for slug in slugs_to_try:
        for attempt in range(2):
            try:
                return await _reporter_run_with_model_slug(
                    job_id,
                    portfolio_data,
                    user_data,
                    db,
                    observability,
                    model_slug=slug,
                )
            except Exception as e:
                last_exc = e
                model_label = slug or "primary"
                if exception_is_provider_unavailable(e):
                    log_llm_provider_outage(
                        e, agent="reporter", job_id=job_id, model=model_label
                    )
                    break
                if exception_is_litellm_rate_limit(e) and attempt + 1 < 2:
                    delay = min(5.0, 1.0 * (2**attempt))
                    logger.warning(
                        "Reporter: rate limit, single backoff %.1fs (attempt %s/2)",
                        delay,
                        attempt + 1,
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error(
                    "Reporter: LLM error type=%s (no further retries in this slug)",
                    type(e).__name__,
                    exc_info=True,
                )
                return {
                    "success": False,
                    "error": LLM_ERROR,
                    "message": short_llm_error_message(e),
                }

    if last_exc is not None and exception_is_provider_unavailable(last_exc):
        return provider_unavailable_response()
    if last_exc is not None:
        return {
            "success": False,
            "error": LLM_ERROR,
            "message": short_llm_error_message(last_exc),
        }
    return provider_unavailable_response()


def lambda_handler(event, context):
    """
    Lambda handler expecting job_id, portfolio_data, and user_data in event.

    Also supports SQS trigger shape: ``{"Records": [{"body": "<json>"}, ...]}``.

    Expected direct event:
    {
        "job_id": "uuid",
        "portfolio_data": {...},
        "user_data": {...}
    }
    """
    print("REPORTER_LAMBDA_TRIGGERED", flush=True)
    logger.info(
        json.dumps(
            {
                "event": "reporter_lambda_received",
                "payload_type": type(event).__name__,
                "has_records": bool(isinstance(event, dict) and event.get("Records")),
            },
            default=str,
        )
    )
    if isinstance(event, str):
        event = json.loads(event)

    if isinstance(event, dict) and isinstance(event.get("Records"), list) and event["Records"]:
        n = len(event["Records"])
        logger.info(
            json.dumps({"event": "reporter_sqs_batch", "record_count": n}, default=str)
        )
        last: Dict[str, Any] | None = None
        for idx, record in enumerate(event["Records"]):
            if not isinstance(record, dict):
                logger.warning("reporter_sqs_skip_non_dict index=%s", idx)
                continue
            body = record.get("body", "{}")
            try:
                inner = json.loads(body) if isinstance(body, str) else (body or {})
            except json.JSONDecodeError:
                logger.exception("reporter_sqs_invalid_json index=%s", idx)
                raise
            logger.info(
                json.dumps(
                    {
                        "event": "reporter_sqs_record",
                        "index": idx,
                        "message_id": record.get("messageId"),
                        "job_id": inner.get("job_id") if isinstance(inner, dict) else None,
                    },
                    default=str,
                )
            )
            last = lambda_handler(inner, context)
        return last if last is not None else {
            "statusCode": 200,
            "body": json.dumps({"status": "processed", "records": 0}),
        }

    step_name = (
        (event.get("step_name") or "reporter") if isinstance(event, dict) else "reporter"
    )
    if step_name not in ("reporter", "researcher"):
        step_name = "reporter"

    log_lambda_agent_start(
        step_name,
        event if isinstance(event, dict) else {},
        context=context,
        received_from_sqs=False,
    )

    tc = normalize_trace_context(event.get("trace_context"))
    job_id = event.get("job_id")
    clerk_user_id = event.get("clerk_user_id")
    portfolio_id = None
    if not job_id:
        raise ValueError("job_id is required")

    db_pre = Database()
    job_row = db_pre.jobs.find_by_id(job_id)
    if not clerk_user_id and job_row:
        clerk_user_id = job_row.get("clerk_user_id")
    if clerk_user_id:
        acc = db_pre.accounts.find_by_user(str(clerk_user_id))
        if acc:
            portfolio_id = str(acc[0]["id"])

    with observe_agent(
        service_name="alex_reporter",
        trace_context=tc,
        user_id=str(clerk_user_id) if clerk_user_id else None,
        job_id=str(job_id),
        portfolio_id=portfolio_id,
        root_span_name=step_name,
        trace_input={"job_id": str(job_id), "step_name": step_name},
        extra_tags=["portfolio_analysis", step_name],
    ) as observability:
        try:
            logger.info(f"Reporter Lambda invoked with event: {json.dumps(event)[:500]}")

            # Initialize database
            db = Database()

            portfolio_data = event.get("portfolio_data")
            if not portfolio_data:
                # Try to load from database
                try:
                    job = db.jobs.find_by_id(job_id)
                    if job:
                        user_id = job["clerk_user_id"]

                        if observability:
                            observability.create_event(
                                name="Reporter Started!", status_message="OK"
                            )
                        user = db.users.find_by_clerk_id(user_id)
                        accounts = db.accounts.find_by_user(user_id)

                        portfolio_data = {"user_id": user_id, "job_id": job_id, "accounts": []}

                        for account in accounts:
                            positions = db.positions.find_by_account(account["id"])
                            account_data = {
                                "id": account["id"],
                                "name": account["account_name"],
                                "type": account.get("account_type", "investment"),
                                "cash_balance": float(account.get("cash_balance", 0)),
                                "positions": [],
                            }

                            for position in positions:
                                instrument = db.instruments.find_by_symbol(position["symbol"])
                                if instrument:
                                    account_data["positions"].append(
                                        {
                                            "symbol": position["symbol"],
                                            "quantity": float(position["quantity"]),
                                            "instrument": instrument,
                                        }
                                    )

                            portfolio_data["accounts"].append(account_data)
                    else:
                        raise RuntimeError(f"Job {job_id} not found")
                except RuntimeError:
                    raise
                except Exception as e:
                    logger.error(f"Could not load portfolio from database: {e}")
                    raise RuntimeError("No portfolio data provided") from e

            user_data = event.get("user_data", {})
            if not user_data:
                # Try to load from database
                try:
                    job = db.jobs.find_by_id(job_id)
                    if job and job.get("clerk_user_id"):
                        status = f"Job ID: {job_id} Clerk User ID: {job['clerk_user_id']}"
                        if observability:
                            observability.create_event(
                                name="Reporter about to run", status_message=status
                            )
                        user = db.users.find_by_clerk_id(job["clerk_user_id"])
                        if user:
                            user_data = {
                                "years_until_retirement": user.get("years_until_retirement", 30),
                                "target_retirement_income": float(
                                    user.get("target_retirement_income", 80000)
                                ),
                            }
                        else:
                            user_data = {
                                "years_until_retirement": 30,
                                "target_retirement_income": 80000,
                            }
                except Exception as e:
                    logger.warning(f"Could not load user data: {e}. Using defaults.")
                    user_data = {"years_until_retirement": 30, "target_retirement_income": 80000}

            # Run the agent
            t0 = time.perf_counter()
            result = asyncio.run(
                run_reporter_agent(job_id, portfolio_data, user_data, db, observability)
            )
            logger.info(
                json.dumps(
                    {
                        "event": "reporter_execution_finished",
                        "job_id": job_id,
                        "step_name": step_name,
                        "duration_ms": round((time.perf_counter() - t0) * 1000.0, 2),
                    },
                    default=str,
                )
            )

            logger.info(f"Reporter completed for job {job_id}")

            return {"statusCode": 200, "body": json.dumps(result)}

        except Exception as e:
            logger.error("Error in reporter lambda_handler: %s", type(e).__name__, exc_info=True)
            err_body = {
                "success": False,
                "error": LLM_ERROR,
                "message": short_llm_error_message(e),
            }
            return {"statusCode": 200, "body": json.dumps(err_body)}


# For local testing
if __name__ == "__main__":
    test_event = {
        "job_id": "550e8400-e29b-41d4-a716-446655440002",
        "portfolio_data": {
            "accounts": [
                {
                    "name": "401(k)",
                    "cash_balance": 5000,
                    "positions": [
                        {
                            "symbol": "SPY",
                            "quantity": 100,
                            "instrument": {
                                "name": "SPDR S&P 500 ETF",
                                "current_price": 450,
                                "asset_class": "equity",
                            },
                        }
                    ],
                }
            ]
        },
        "user_data": {"years_until_retirement": 25, "target_retirement_income": 75000},
    }

    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))
