"""
InstrumentTagger Lambda Handler
Classifies financial instruments and updates the database.
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, List

try:
    from dotenv import load_dotenv

    load_dotenv(override=True)
except ImportError:
    pass

os.environ.setdefault("OPENAI_AGENTS_DISABLE_TRACING", "true")

from agents import trace

from src import Database
from agent import classification_to_db_format, tag_instruments
from alex_llm.lambda_observability import log_lambda_agent_start
from alex_llm.openrouter_resilience import LLM_ERROR, short_llm_error_message
from alex_llm.tracing import normalize_trace_context, observe_agent

logger = logging.getLogger()
logger.setLevel(logging.INFO)

db = Database()


async def process_instruments(instruments: List[Dict[str, str]]) -> Dict[str, Any]:
    """Process and classify instruments asynchronously."""
    logger.info("Classifying %s instruments", len(instruments))
    classifications, hard_fail = await tag_instruments(instruments)
    if hard_fail is not None:
        return {
            **hard_fail,
            "tagged": 0,
            "updated": [],
            "errors": [],
            "classifications": [],
        }

    updated: List[str] = []
    errors: List[Dict[str, str]] = []

    for classification in classifications:
        try:
            db_instrument = classification_to_db_format(classification)
            existing = db.instruments.find_by_symbol(classification.symbol)

            if existing:
                update_data = db_instrument.model_dump()
                del update_data["symbol"]
                db.instruments.update_by_symbol(classification.symbol, update_data)
                logger.info("Updated %s in database", classification.symbol)
            else:
                db.instruments.create_instrument(db_instrument)
                logger.info("Created %s in database", classification.symbol)

            updated.append(classification.symbol)

        except Exception as e:
            logger.error("Error updating %s: %s", classification.symbol, e)
            errors.append({"symbol": classification.symbol, "error": str(e)})

    return {
        "tagged": len(classifications),
        "updated": updated,
        "errors": errors,
        "classifications": [
            {
                "symbol": c.symbol,
                "name": c.name,
                "type": c.instrument_type,
                "current_price": c.current_price,
                "asset_class": c.allocation_asset_class.model_dump(),
                "regions": c.allocation_regions.model_dump(by_alias=True),
                "sectors": c.allocation_sectors.model_dump(),
            }
            for c in classifications
        ],
    }


def lambda_handler(event, context=None):
    """
    Lambda handler for instrument tagging.

    Expected event format:
    {
        "instruments": [
            {"symbol": "VTI", "name": "Vanguard Total Stock Market ETF"},
            ...
        ]
    }
    """
    print("TAGGER_LAMBDA_TRIGGERED", flush=True)
    if isinstance(event, str):
        try:
            event = json.loads(event)
        except json.JSONDecodeError:
            event = {}

    tc = normalize_trace_context(event.get("trace_context") if isinstance(event, dict) else None)
    clerk_user_id = event.get("clerk_user_id") if isinstance(event, dict) else None
    job_id = event.get("job_id") if isinstance(event, dict) else None

    log_lambda_agent_start(
        "tagger",
        event if isinstance(event, dict) else {},
        context=context,
        received_from_sqs=False,
    )

    with observe_agent(
        service_name="alex_tagger",
        trace_context=tc,
        user_id=str(clerk_user_id) if clerk_user_id else None,
        job_id=str(job_id) if job_id else None,
        root_span_name="tagger",
        trace_input={"job_id": str(job_id)} if job_id else {"phase": "instrument_tagging"},
        extra_tags=["portfolio_analysis", "tagger"],
    ):
        try:
            instruments = event.get("instruments", []) if isinstance(event, dict) else []

            if not instruments:
                raise ValueError("No instruments provided")

            t0 = time.perf_counter()
            with trace("Tagger Agent"):
                result = asyncio.run(process_instruments(instruments))
            logger.info(
                json.dumps(
                    {
                        "event": "tagger_execution_finished",
                        "job_id": job_id,
                        "duration_ms": round((time.perf_counter() - t0) * 1000.0, 2),
                        "tagged": result.get("tagged"),
                    },
                    default=str,
                )
            )

            return {"statusCode": 200, "body": json.dumps(result)}

        except Exception as e:
            logger.error("Lambda handler error: %s", type(e).__name__, exc_info=True)
            err_body = {
                "success": False,
                "error": LLM_ERROR,
                "message": short_llm_error_message(e),
                "tagged": 0,
                "updated": [],
                "errors": [],
                "classifications": [],
            }
            return {"statusCode": 200, "body": json.dumps(err_body)}
