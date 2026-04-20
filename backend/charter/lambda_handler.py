"""
Chart Maker Agent Lambda Handler
"""

import os
import json
import asyncio
import logging
import time
from typing import Any, Dict

try:
    from dotenv import load_dotenv

    load_dotenv(override=True)
except ImportError:
    pass

os.environ.setdefault("OPENAI_AGENTS_DISABLE_TRACING", "true")

from agents import Agent, Runner, trace

from src import Database

from templates import CHARTER_INSTRUCTIONS
from agent import create_agent
from chart_contract import (
    empty_charts_payload,
    log_raw_charter_output,
    normalize_and_validate_charts,
    safe_json_parse,
)
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


def _charter_success_body(
    charts: Dict[str, Any],
    *,
    message: str,
    error: str | None = None,
) -> Dict[str, Any]:
    return {
        "success": True,
        "charts": charts,
        "message": message,
        **({"error": error} if error else {}),
    }


async def _charter_run_llm_once(
    job_id: str,
    portfolio_data: Dict[str, Any],
    db,
    *,
    model_slug: str | None,
) -> Dict[str, Any]:
    """Single charter LLM pass + parse + DB write. Never returns success=False."""
    empty = empty_charts_payload()
    try:
        model, task = create_agent(job_id, portfolio_data, db, model_slug=model_slug)
    except Exception as e:
        logger.exception("Charter: create_agent failed job_id=%s", job_id)
        try:
            if db:
                db.jobs.update_charts(job_id, empty)
        except Exception:
            logger.exception("Charter: could not persist empty charts job_id=%s", job_id)
        return _charter_success_body(
            empty,
            message="Charter setup failed; charts cleared.",
            error=short_llm_error_message(e),
        )

    output_str = ""
    try:
        with trace("Charter Agent"):
            agent = Agent(
                name="Chart Maker",
                instructions=CHARTER_INSTRUCTIONS,
                model=model,
            )

            result = await Runner.run(
                agent,
                input=task,
                max_turns=5,
            )

            output = result.final_output
            output_str = output if isinstance(output, str) else (str(output) if output is not None else "")
            log_raw_charter_output(job_id, output_str)

            parsed_obj: Any = None
            if output_str.strip():
                start_idx = output_str.find("{")
                end_idx = output_str.rfind("}")
                if start_idx >= 0 and end_idx > start_idx:
                    json_str = output_str[start_idx : end_idx + 1]
                    logger.info("Charter: extracted JSON substring len=%s", len(json_str))
                    parsed_obj = safe_json_parse(json_str)
                    if parsed_obj is None:
                        try:
                            parsed_obj = json.loads(json_str)
                        except json.JSONDecodeError as je:
                            logger.error("Charter: JSON decode error: %s", je)
                            parsed_obj = None
                else:
                    logger.warning("Charter: no JSON braces in model output job_id=%s", job_id)

            logger.info(
                "Charter: parsed_preview job_id=%s type=%s",
                job_id,
                type(parsed_obj).__name__,
            )
            charts_payload, norm_warn = normalize_and_validate_charts(
                parsed_obj,
                job_id=job_id,
                raw_llm_snippet=output_str,
            )
            if norm_warn:
                logger.warning("Charter: normalize_warning job_id=%s warn=%s", job_id, norm_warn)

            try:
                if db:
                    db.jobs.update_charts(job_id, charts_payload)
                    logger.info(
                        "Charter: charts persisted job_id=%s keys=%s",
                        job_id,
                        list(charts_payload.keys()),
                    )
            except Exception as db_e:
                logger.exception("Charter: DB update_charts failed job_id=%s", job_id)
                return _charter_success_body(
                    charts_payload,
                    message="Charts parsed but not saved.",
                    error=str(db_e)[:500],
                )

            n_alloc = len(charts_payload.get("allocation", {}).get("data") or [])
            n_perf = len(charts_payload.get("performance", {}).get("data") or [])
            return _charter_success_body(
                charts_payload,
                message=f"Charter OK (allocation={n_alloc} performance={n_perf})",
                error=norm_warn,
            )

    except Exception as e:
        logger.exception("Charter: run failed job_id=%s", job_id)
        try:
            if db:
                db.jobs.update_charts(job_id, empty)
        except Exception:
            logger.exception("Charter: fallback empty charts DB failed job_id=%s", job_id)
        return _charter_success_body(
            empty,
            message="Charter run failed; empty charts stored.",
            error=short_llm_error_message(e),
        )


async def run_charter_agent(job_id: str, portfolio_data: Dict[str, Any], db=None) -> Dict[str, Any]:
    """Bounded retries; **always** success=True with charts dict (possibly empty)."""
    fb = openrouter_fallback_slug("reasoning")
    slugs: list[str | None] = [None]
    if fb:
        slugs.append(fb)
    last_exc: BaseException | None = None
    empty = empty_charts_payload()
    for slug in slugs:
        for attempt in range(2):
            try:
                return await _charter_run_llm_once(job_id, portfolio_data, db, model_slug=slug)
            except BaseException as e:
                last_exc = e
                if exception_is_provider_unavailable(e):
                    log_llm_provider_outage(
                        e, agent="charter", job_id=job_id, model=slug or "primary"
                    )
                    break
                if exception_is_litellm_rate_limit(e) and attempt + 1 < 2:
                    delay = min(5.0, 1.0 * (2**attempt))
                    logger.warning(
                        "Charter: rate limit backoff %.1fs (attempt %s/2)",
                        delay,
                        attempt + 1,
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error(
                    "Charter: LLM error type=%s",
                    type(e).__name__,
                    exc_info=True,
                )
                try:
                    if db:
                        db.jobs.update_charts(job_id, empty)
                except Exception:
                    logger.exception("Charter: empty charts after LLM error failed job_id=%s", job_id)
                return _charter_success_body(
                    empty,
                    message="Charter LLM error; continuing with empty charts.",
                    error=short_llm_error_message(e),
                )
    if last_exc is not None and exception_is_provider_unavailable(last_exc):
        try:
            if db:
                db.jobs.update_charts(job_id, empty)
        except Exception:
            pass
        body = dict(provider_unavailable_response())
        body["success"] = True
        body["charts"] = empty
        body.setdefault("message", "Provider unavailable; empty charts.")
        return body
    if last_exc is not None:
        try:
            if db:
                db.jobs.update_charts(job_id, empty)
        except Exception:
            pass
        return _charter_success_body(
            empty,
            message="Charter exhausted retries; empty charts.",
            error=short_llm_error_message(last_exc),
        )
    try:
        if db:
            db.jobs.update_charts(job_id, empty)
    except Exception:
        pass
    body = dict(provider_unavailable_response())
    body["success"] = True
    body["charts"] = empty
    return body


def lambda_handler(event, context=None):
    print("CHARTER_LAMBDA_TRIGGERED", flush=True)
    if isinstance(event, str):
        event = json.loads(event)

    tc = normalize_trace_context(event.get("trace_context") if isinstance(event, dict) else None)
    job_id = event.get("job_id") if isinstance(event, dict) else None
    if not job_id:
        return {
            "statusCode": 200,
            "body": json.dumps(
                _charter_success_body(
                    empty_charts_payload(),
                    message="Missing job_id",
                    error="job_id is required",
                )
            ),
        }

    log_lambda_agent_start(
        "charter",
        event if isinstance(event, dict) else {},
        context=context,
        received_from_sqs=False,
    )

    db0 = Database()
    job_row = db0.jobs.find_by_id(job_id)
    clerk_user_id = (event.get("clerk_user_id") if isinstance(event, dict) else None) or (
        (job_row or {}).get("clerk_user_id")
    )
    portfolio_id = None
    if clerk_user_id:
        acc = db0.accounts.find_by_user(str(clerk_user_id))
        if acc:
            portfolio_id = str(acc[0]["id"])

    with observe_agent(
        service_name="alex_charter",
        trace_context=tc,
        user_id=str(clerk_user_id) if clerk_user_id else None,
        job_id=str(job_id),
        portfolio_id=portfolio_id,
        root_span_name="charter",
        trace_input={"job_id": str(job_id)},
        extra_tags=["portfolio_analysis", "charter"],
    ):
        try:
            logger.info(
                "Charter Lambda invoked with event keys: %s",
                list(event.keys()) if isinstance(event, dict) else "not a dict",
            )

            db = Database()
            portfolio_data = event.get("portfolio_data")
            if not portfolio_data:
                logger.info("Charter: loading portfolio data for job %s", job_id)
                try:
                    job = db.jobs.find_by_id(job_id)
                    if not job:
                        logger.error("Charter: job %s not found — empty charts", job_id)
                        out = _charter_success_body(
                            empty_charts_payload(),
                            message="Job not found",
                            error="job_not_found",
                        )
                        return {"statusCode": 200, "body": json.dumps(out)}

                    user_id = job["clerk_user_id"]
                    user = db.users.find_by_clerk_id(user_id)
                    accounts = db.accounts.find_by_user(user_id)

                    portfolio_data = {
                        "user_id": user_id,
                        "job_id": job_id,
                        "years_until_retirement": user.get("years_until_retirement", 30) if user else 30,
                        "accounts": [],
                    }

                    for account in accounts:
                        account_data = {
                            "id": account["id"],
                            "name": account["account_name"],
                            "type": account.get("account_type", "investment"),
                            "cash_balance": float(account.get("cash_balance", 0)),
                            "positions": [],
                        }

                        positions = db.positions.find_by_account(account["id"])
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

                    logger.info(
                        "Charter: loaded %s accounts",
                        len(portfolio_data["accounts"]),
                    )
                except Exception as e:
                    logger.exception("Charter: portfolio load error")
                    out = _charter_success_body(
                        empty_charts_payload(),
                        message="Failed to load portfolio",
                        error=str(e)[:500],
                    )
                    return {"statusCode": 200, "body": json.dumps(out)}

            t0 = time.perf_counter()
            result = asyncio.run(run_charter_agent(job_id, portfolio_data, db))
            logger.info(
                json.dumps(
                    {
                        "event": "charter_execution_finished",
                        "job_id": job_id,
                        "duration_ms": round((time.perf_counter() - t0) * 1000.0, 2),
                        "success": result.get("success"),
                    },
                    default=str,
                )
            )

            if result.get("success") is not True:
                result = _charter_success_body(
                    result.get("charts") if isinstance(result.get("charts"), dict) else empty_charts_payload(),
                    message=str(result.get("message") or "normalized"),
                    error=str(result.get("error") or "")[:300] or None,
                )

            return {"statusCode": 200, "body": json.dumps(result)}

        except Exception as e:
            logger.error("Error in charter lambda_handler: %s", type(e).__name__, exc_info=True)
            err_body = _charter_success_body(
                empty_charts_payload(),
                message="Charter handler exception",
                error=short_llm_error_message(e),
            )
            return {"statusCode": 200, "body": json.dumps(err_body)}


if __name__ == "__main__":
    test_event = {
        "job_id": "550e8400-e29b-41d4-a716-446655440001",
        "portfolio_data": {
            "accounts": [
                {
                    "id": "acc1",
                    "name": "401(k)",
                    "type": "401k",
                    "cash_balance": 5000,
                    "positions": [
                        {
                            "symbol": "SPY",
                            "quantity": 100,
                            "instrument": {
                                "name": "SPDR S&P 500 ETF",
                                "current_price": 450,
                                "allocation_asset_class": {"equity": 100},
                                "allocation_regions": {"north_america": 100},
                                "allocation_sectors": {
                                    "technology": 30,
                                    "healthcare": 15,
                                    "financials": 15,
                                    "consumer_discretionary": 20,
                                    "industrials": 20,
                                },
                            },
                        }
                    ],
                }
            ]
        },
    }

    print(json.dumps(lambda_handler(test_event, None), indent=2))
