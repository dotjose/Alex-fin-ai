"""
Retirement Specialist Agent Lambda Handler
"""

import os
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

os.environ.setdefault("OPENAI_AGENTS_DISABLE_TRACING", "true")

from agents import Agent, Runner, trace

# Import database package
from src import Database

from templates import RETIREMENT_INSTRUCTIONS
from agent import create_agent
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

def get_user_preferences(job_id: str) -> Dict[str, Any]:
    """Load user preferences from database."""
    try:
        db = Database()
        
        # Get the job to find the user
        job = db.jobs.find_by_id(job_id)
        if job and job.get('clerk_user_id'):
            # Get user preferences
            user = db.users.find_by_clerk_id(job['clerk_user_id'])
            if user:
                return {
                    'years_until_retirement': user.get('years_until_retirement', 30),
                    'target_retirement_income': float(user.get('target_retirement_income', 80000)),
                    'current_age': 40  # Default for now
                }
    except Exception as e:
        logger.warning(f"Could not load user data: {e}. Using defaults.")
    
    return {
        'years_until_retirement': 30,
        'target_retirement_income': 80000.0,
        'current_age': 40
    }

async def _retirement_run_once(
    job_id: str, portfolio_data: Dict[str, Any], *, model_slug: str | None
) -> Dict[str, Any]:
    """Single retirement LLM pass + DB write."""
    user_preferences = get_user_preferences(job_id)
    db = Database()
    model, tools, task = create_agent(
        job_id, portfolio_data, user_preferences, db, model_slug=model_slug
    )

    with trace("Retirement Agent"):
        agent = Agent(
            name="Retirement Specialist",
            instructions=RETIREMENT_INSTRUCTIONS,
            model=model,
            tools=tools,
        )

        result = await Runner.run(
            agent,
            input=task,
            max_turns=20,
        )

        retirement_payload = {
            "analysis": result.final_output,
            "generated_at": datetime.utcnow().isoformat(),
            "agent": "retirement",
        }

        success = db.jobs.update_retirement(job_id, retirement_payload)

        if not success:
            logger.error(f"Failed to save retirement analysis for job {job_id}")

        return {
            "success": success,
            "message": "Retirement analysis completed"
            if success
            else "Analysis completed but failed to save",
            "final_output": result.final_output,
        }


async def run_retirement_agent(job_id: str, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
    """At most 2 rate-limit retries per model slug; fail fast on provider 503."""
    fb = openrouter_fallback_slug("reasoning")
    slugs: list[str | None] = [None]
    if fb:
        slugs.append(fb)
    last_exc: BaseException | None = None
    for slug in slugs:
        for attempt in range(2):
            try:
                return await _retirement_run_once(job_id, portfolio_data, model_slug=slug)
            except BaseException as e:
                last_exc = e
                if exception_is_provider_unavailable(e):
                    log_llm_provider_outage(
                        e, agent="retirement", job_id=job_id, model=slug or "primary"
                    )
                    break
                if isinstance(e, (TimeoutError, asyncio.TimeoutError)) and attempt + 1 < 2:
                    delay = min(5.0, 1.0 * (2**attempt))
                    logger.warning("Retirement: timeout backoff %.1fs (attempt %s/2)", delay, attempt + 1)
                    await asyncio.sleep(delay)
                    continue
                if exception_is_litellm_rate_limit(e) and attempt + 1 < 2:
                    delay = min(5.0, 1.0 * (2**attempt))
                    logger.warning(
                        "Retirement: rate limit backoff %.1fs (attempt %s/2)",
                        delay,
                        attempt + 1,
                    )
                    await asyncio.sleep(delay)
                    continue
                err_lower = str(e).lower()
                if ("timeout" in err_lower or "throttled" in err_lower) and attempt + 1 < 2:
                    delay = min(5.0, 1.0 * (2**attempt))
                    logger.warning(
                        "Retirement: transient error backoff %.1fs (attempt %s/2)",
                        delay,
                        attempt + 1,
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error(
                    "Retirement: LLM error type=%s",
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
    Lambda handler expecting job_id in event.

    Expected event:
    {
        "job_id": "uuid",
        "portfolio_data": {...}  # Optional, will load from DB if not provided
    }
    """
    print("RETIREMENT_LAMBDA_TRIGGERED", flush=True)
    if isinstance(event, str):
        event = json.loads(event)

    tc = normalize_trace_context(event.get("trace_context") if isinstance(event, dict) else None)
    job_id = event.get("job_id") if isinstance(event, dict) else None
    if not job_id:
        raise ValueError("job_id is required")

    log_lambda_agent_start(
        "retirement",
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
        service_name="alex_retirement",
        trace_context=tc,
        user_id=str(clerk_user_id) if clerk_user_id else None,
        job_id=str(job_id),
        portfolio_id=portfolio_id,
        root_span_name="retirement",
        trace_input={"job_id": str(job_id)},
        extra_tags=["portfolio_analysis", "retirement"],
    ) as observability:
        try:
            logger.info(f"Retirement Lambda invoked with event: {json.dumps(event)[:500]}")

            portfolio_data = event.get("portfolio_data") if isinstance(event, dict) else None
            if not portfolio_data:
                # Try to load from database
                logger.info(f"Retirement Loading portfolio data for job {job_id}")
                try:
                    db = db0
                    job = db.jobs.find_by_id(job_id)
                    if job:
                        if observability:
                            observability.create_event(
                                name="Retirement Started!", status_message="OK"
                            )
                        
                        # portfolio_data = job.get('request_payload', {}).get('portfolio_data', {})
                        user_id = job['clerk_user_id']
                        user = db.users.find_by_clerk_id(user_id)
                        accounts = db.accounts.find_by_user(user_id)

                        portfolio_data = {
                            'user_id': user_id,
                            'job_id': job_id,
                            'years_until_retirement': user.get('years_until_retirement', 30) if user else 30,
                            'accounts': []
                        }

                        for account in accounts:
                            account_data = {
                                'id': account['id'],
                                'name': account['account_name'],
                                'type': account.get('account_type', 'investment'),
                                'cash_balance': float(account.get('cash_balance', 0)),
                                'positions': []
                            }

                            positions = db.positions.find_by_account(account['id'])
                            for position in positions:
                                instrument = db.instruments.find_by_symbol(position['symbol'])
                                if instrument:
                                    account_data['positions'].append({
                                        'symbol': position['symbol'],
                                        'quantity': float(position['quantity']),
                                        'instrument': instrument
                                    })

                            portfolio_data['accounts'].append(account_data)

                        logger.info(f"Retirement: Loaded {len(portfolio_data['accounts'])} accounts with positions")
                    else:
                        logger.error(f"Retirement: Job {job_id} not found")
                        raise RuntimeError(f"Job {job_id} not found")
                except RuntimeError:
                    raise
                except Exception as e:
                    logger.error(f"Could not load portfolio from database: {e}")
                    raise RuntimeError("No portfolio data provided") from e

            logger.info(f"Retirement: Processing job {job_id}")

            # Run the agent
            t0 = time.perf_counter()
            result = asyncio.run(run_retirement_agent(job_id, portfolio_data))
            logger.info(
                json.dumps(
                    {
                        "event": "retirement_execution_finished",
                        "job_id": job_id,
                        "duration_ms": round((time.perf_counter() - t0) * 1000.0, 2),
                        "success": result.get("success"),
                    },
                    default=str,
                )
            )

            logger.info(f"Retirement completed for job {job_id}")

            return {
                'statusCode': 200,
                'body': json.dumps(result)
            }

        except Exception as e:
            logger.error("Error in retirement lambda_handler: %s", type(e).__name__, exc_info=True)
            err_body = {
                "success": False,
                "error": LLM_ERROR,
                "message": short_llm_error_message(e),
            }
            return {"statusCode": 200, "body": json.dumps(err_body)}

# For local testing
if __name__ == "__main__":
    test_event = {
        "job_id": "test-retirement-123",
        "portfolio_data": {
            "accounts": [
                {
                    "name": "401(k)",
                    "type": "retirement",
                    "cash_balance": 10000,
                    "positions": [
                        {
                            "symbol": "SPY",
                            "quantity": 100,
                            "instrument": {
                                "name": "SPDR S&P 500 ETF",
                                "current_price": 450,
                                "allocation_asset_class": {"equity": 100}
                            }
                        },
                        {
                            "symbol": "BND",
                            "quantity": 100,
                            "instrument": {
                                "name": "Vanguard Total Bond Market ETF",
                                "current_price": 75,
                                "allocation_asset_class": {"fixed_income": 100}
                            }
                        }
                    ]
                }
            ]
        }
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))