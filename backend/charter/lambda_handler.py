"""
Chart Maker Agent Lambda Handler
"""

import os
import json
import asyncio
import logging
import time
from typing import Dict, Any

try:
    from dotenv import load_dotenv

    load_dotenv(override=True)
except ImportError:
    pass

os.environ.setdefault("OPENAI_AGENTS_DISABLE_TRACING", "true")

from agents import Agent, Runner, trace

# Import database package
from src import Database

from templates import CHARTER_INSTRUCTIONS
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


async def _charter_run_llm_once(
    job_id: str,
    portfolio_data: Dict[str, Any],
    db,
    *,
    model_slug: str | None,
) -> Dict[str, Any]:
    """Single charter LLM pass + parse + optional DB write."""
    model, task = create_agent(job_id, portfolio_data, db, model_slug=model_slug)
    
    # Run agent - no tools, no context
    with trace("Charter Agent"):
        agent = Agent(
            name="Chart Maker",
            instructions=CHARTER_INSTRUCTIONS,
            model=model
        )
        
        result = await Runner.run(
            agent,
            input=task,
            max_turns=5  # Reduced since we expect one-shot JSON response
        )
        
        # Extract and parse JSON from the output
        output = result.final_output
        logger.info(f"Charter: Agent completed, output length: {len(output) if output else 0}")
        
        # Log the actual output for debugging
        if output:
            logger.info(f"Charter: Output preview (first 1000 chars): {output[:1000]}")
        else:
            logger.warning("Charter: Agent returned empty output!")
            # Check if there were any messages
            if hasattr(result, 'messages') and result.messages:
                logger.info(f"Charter: Number of messages: {len(result.messages)}")
                for i, msg in enumerate(result.messages):
                    logger.info(f"Charter: Message {i}: {str(msg)[:500]}")
        
        # Parse the JSON output
        charts_data = None
        charts_saved = False
        
        if output:
            # Try to find JSON in the output
            # Look for the opening and closing braces of the JSON object
            start_idx = output.find('{')
            end_idx = output.rfind('}')
            
            if start_idx >= 0 and end_idx > start_idx:
                json_str = output[start_idx:end_idx + 1]
                logger.info(f"Charter: Extracted JSON substring, length: {len(json_str)}")
                
                try:
                    parsed_data = json.loads(json_str)
                    charts = parsed_data.get('charts', [])
                    logger.info(f"Charter: Successfully parsed JSON, found {len(charts)} charts")
                    
                    if charts:
                        # Build the charts_payload with chart keys as top-level keys
                        charts_data = {}
                        for chart in charts:
                            chart_key = chart.get('key', f"chart_{len(charts_data) + 1}")
                            # Remove the 'key' from the chart data since it's now the dict key
                            chart_copy = {k: v for k, v in chart.items() if k != 'key'}
                            charts_data[chart_key] = chart_copy
                        
                        logger.info(f"Charter: Created charts_data with keys: {list(charts_data.keys())}")
                        
                        # Save to database
                        if db and charts_data:
                            try:
                                success = db.jobs.update_charts(job_id, charts_data)
                                charts_saved = bool(success)
                                logger.info(f"Charter: Database update returned: {success}")
                            except Exception as e:
                                logger.error(f"Charter: Database error: {e}")
                    else:
                        logger.warning("Charter: No charts found in parsed JSON")
                        
                except json.JSONDecodeError as e:
                    logger.error(f"Charter: Failed to parse JSON: {e}")
                    logger.error(f"Charter: JSON string attempted: {json_str[:500]}...")
            else:
                logger.error(f"Charter: No JSON structure found in output")
                logger.error(f"Charter: Output preview: {output[:500]}...")
        
        return {
            'success': charts_saved,
            'message': f'Generated {len(charts_data) if charts_data else 0} charts' if charts_saved else 'Failed to generate charts',
            'charts_generated': len(charts_data) if charts_data else 0,
            'chart_keys': list(charts_data.keys()) if charts_data else []
        }


async def run_charter_agent(job_id: str, portfolio_data: Dict[str, Any], db=None) -> Dict[str, Any]:
    """Bounded rate-limit retries only; provider 503 / no healthy upstream → fail fast or fallback slug."""
    fb = openrouter_fallback_slug("reasoning")
    slugs: list[str | None] = [None]
    if fb:
        slugs.append(fb)
    last_exc: BaseException | None = None
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


def lambda_handler(event, context=None):
    """
    Lambda handler expecting job_id and portfolio_data in event.

    Expected event:
    {
        "job_id": "uuid",
        "portfolio_data": {...}
    }
    """
    print("CHARTER_LAMBDA_TRIGGERED", flush=True)
    if isinstance(event, str):
        event = json.loads(event)

    tc = normalize_trace_context(event.get("trace_context") if isinstance(event, dict) else None)
    job_id = event.get("job_id") if isinstance(event, dict) else None
    if not job_id:
        raise ValueError("job_id is required")

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

            # Initialize database first
            db = Database()

            portfolio_data = event.get('portfolio_data')
            if not portfolio_data:
                # Load portfolio data from database (like Reporter does)
                logger.info(f"Charter: Loading portfolio data for job {job_id}")
                try:
                    job = db.jobs.find_by_id(job_id)
                    if job:
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

                        logger.info(f"Charter: Loaded {len(portfolio_data['accounts'])} accounts with positions")
                    else:
                        logger.error(f"Charter: Job {job_id} not found")
                        raise RuntimeError(f"Job {job_id} not found")
                except RuntimeError:
                    raise
                except Exception as e:
                    logger.error(f"Charter: Error loading portfolio data: {e}")
                    raise RuntimeError(f"Failed to load portfolio data: {e}") from e

            logger.info(f"Charter: Processing job {job_id}")

            # Run the agent
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

            logger.info(f"Charter completed for job {job_id}: {result}")

            return {
                'statusCode': 200,
                'body': json.dumps(result)
            }

        except Exception as e:
            logger.error("Error in charter lambda_handler: %s", type(e).__name__, exc_info=True)
            err_body = {
                "success": False,
                "error": LLM_ERROR,
                "message": short_llm_error_message(e),
            }
            return {"statusCode": 200, "body": json.dumps(err_body)}

# For local testing
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
                                "allocation_sectors": {"technology": 30, "healthcare": 15, "financials": 15, "consumer_discretionary": 20, "industrials": 20}
                            }
                        }
                    ]
                }
            ]
        }
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))