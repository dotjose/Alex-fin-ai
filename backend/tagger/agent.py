"""
InstrumentTagger Agent - Classifies financial instruments using OpenAI Agents SDK + OpenRouter.
"""

import asyncio
import logging
import os
from decimal import Decimal
from typing import List

from pydantic import BaseModel, ConfigDict, Field, field_validator
from agents import Agent, Runner, trace
from dotenv import load_dotenv

from alex_llm.llm import get_llm
from src.schemas import InstrumentCreate
from templates import CLASSIFICATION_PROMPT, TAGGER_INSTRUCTIONS

load_dotenv(override=True)

logger = logging.getLogger(__name__)


class AllocationBreakdown(BaseModel):
    """Allocation percentages that must sum to 100"""

    model_config = ConfigDict(extra="forbid")

    equity: float = Field(default=0.0, ge=0, le=100, description="Equity percentage")
    fixed_income: float = Field(default=0.0, ge=0, le=100, description="Fixed income percentage")
    real_estate: float = Field(default=0.0, ge=0, le=100, description="Real estate percentage")
    commodities: float = Field(default=0.0, ge=0, le=100, description="Commodities percentage")
    cash: float = Field(default=0.0, ge=0, le=100, description="Cash percentage")
    alternatives: float = Field(default=0.0, ge=0, le=100, description="Alternatives percentage")


class RegionAllocation(BaseModel):
    """Regional allocation percentages"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    north_america: float = Field(default=0.0, ge=0, le=100)
    europe: float = Field(default=0.0, ge=0, le=100)
    asia: float = Field(default=0.0, ge=0, le=100)
    latin_america: float = Field(default=0.0, ge=0, le=100)
    africa: float = Field(default=0.0, ge=0, le=100)
    middle_east: float = Field(default=0.0, ge=0, le=100)
    oceania: float = Field(default=0.0, ge=0, le=100)
    global_: float = Field(
        default=0.0, ge=0, le=100, alias="global", description="Global or diversified"
    )
    international: float = Field(
        default=0.0, ge=0, le=100, description="International developed markets"
    )


class SectorAllocation(BaseModel):
    """Sector allocation percentages"""

    model_config = ConfigDict(extra="forbid")

    technology: float = Field(default=0.0, ge=0, le=100)
    healthcare: float = Field(default=0.0, ge=0, le=100)
    financials: float = Field(default=0.0, ge=0, le=100)
    consumer_discretionary: float = Field(default=0.0, ge=0, le=100)
    consumer_staples: float = Field(default=0.0, ge=0, le=100)
    industrials: float = Field(default=0.0, ge=0, le=100)
    materials: float = Field(default=0.0, ge=0, le=100)
    energy: float = Field(default=0.0, ge=0, le=100)
    utilities: float = Field(default=0.0, ge=0, le=100)
    real_estate: float = Field(default=0.0, ge=0, le=100, description="Real estate sector")
    communication: float = Field(default=0.0, ge=0, le=100)
    treasury: float = Field(default=0.0, ge=0, le=100, description="Treasury bonds")
    corporate: float = Field(default=0.0, ge=0, le=100, description="Corporate bonds")
    mortgage: float = Field(default=0.0, ge=0, le=100, description="Mortgage-backed securities")
    government_related: float = Field(
        default=0.0, ge=0, le=100, description="Government-related bonds"
    )
    commodities: float = Field(default=0.0, ge=0, le=100, description="Commodities")
    diversified: float = Field(default=0.0, ge=0, le=100, description="Diversified sectors")
    other: float = Field(default=0.0, ge=0, le=100, description="Other sectors")


class InstrumentClassification(BaseModel):
    """Structured output for instrument classification"""

    model_config = ConfigDict(extra="forbid")

    symbol: str = Field(description="Ticker symbol of the instrument")
    name: str = Field(description="Name of the instrument")
    instrument_type: str = Field(description="Type: etf, stock, mutual_fund, bond_fund, etc.")
    current_price: float = Field(description="Current price per share in USD", gt=0)

    allocation_asset_class: AllocationBreakdown = Field(description="Asset class breakdown")
    allocation_regions: RegionAllocation = Field(description="Regional breakdown")
    allocation_sectors: SectorAllocation = Field(description="Sector breakdown")

    @field_validator("allocation_asset_class")
    @classmethod
    def validate_asset_class_sum(cls, v: AllocationBreakdown):
        total = v.equity + v.fixed_income + v.real_estate + v.commodities + v.cash + v.alternatives
        if abs(total - 100.0) > 3:
            raise ValueError(f"Asset class allocations must sum to 100.0, got {total}")
        return v

    @field_validator("allocation_regions")
    @classmethod
    def validate_regions_sum(cls, v: RegionAllocation):
        total = (
            v.north_america
            + v.europe
            + v.asia
            + v.latin_america
            + v.africa
            + v.middle_east
            + v.oceania
            + v.global_
            + v.international
        )
        if abs(total - 100.0) > 3:
            raise ValueError(f"Regional allocations must sum to 100.0, got {total}")
        return v

    @field_validator("allocation_sectors")
    @classmethod
    def validate_sectors_sum(cls, v: SectorAllocation):
        total = (
            v.technology
            + v.healthcare
            + v.financials
            + v.consumer_discretionary
            + v.consumer_staples
            + v.industrials
            + v.materials
            + v.energy
            + v.utilities
            + v.real_estate
            + v.communication
            + v.treasury
            + v.corporate
            + v.mortgage
            + v.government_related
            + v.commodities
            + v.diversified
            + v.other
        )
        if abs(total - 100.0) > 3:
            raise ValueError(f"Sector allocations must sum to 100.0, got {total}")
        return v


async def classify_instrument(
    symbol: str, name: str, instrument_type: str = "etf"
) -> InstrumentClassification:
    """Classify a financial instrument using OpenAI Agents SDK + OpenRouter."""
    try:
        model = get_llm("reasoning")
        task = CLASSIFICATION_PROMPT.format(
            symbol=symbol, name=name, instrument_type=instrument_type
        )

        with trace(f"Classify {symbol}"):
            agent = Agent(
                name="InstrumentTagger",
                instructions=TAGGER_INSTRUCTIONS,
                model=model,
                tools=[],
                output_type=InstrumentClassification,
            )

            result = await Runner.run(agent, input=task, max_turns=5)
            return result.final_output_as(InstrumentClassification)

    except Exception as e:
        logger.error("Error classifying %s: %s", symbol, e)
        raise


async def tag_instruments(
    instruments: List[dict],
) -> tuple[List[InstrumentClassification], dict | None]:
    """
    Tag instruments. At most one rate-limit retry per symbol (2 attempts total).

    Returns ``(classifications, failure_dict)`` where ``failure_dict`` is set on
    provider-level outage (503 / no healthy upstream) so the handler can return
    a structured response without crashing the planner.
    """
    from alex_llm.openrouter_resilience import (
        exception_is_litellm_rate_limit,
        exception_is_provider_unavailable,
        log_llm_provider_outage,
        provider_unavailable_response,
    )

    results: List[InstrumentClassification] = []
    for i, instrument in enumerate(instruments):
        if i > 0:
            await asyncio.sleep(0.5)

        symbol = instrument["symbol"]
        name = instrument.get("name", "")
        instrument_type = instrument.get("instrument_type", "etf")
        last_exc: BaseException | None = None
        for attempt in range(2):
            try:
                classification = await classify_instrument(symbol, name, instrument_type)
                logger.info("Successfully classified %s", symbol)
                results.append(classification)
                break
            except BaseException as e:
                last_exc = e
                if exception_is_provider_unavailable(e):
                    log_llm_provider_outage(
                        e, agent="tagger", job_id=None, model="reasoning"
                    )
                    return results, provider_unavailable_response()
                if exception_is_litellm_rate_limit(e) and attempt + 1 < 2:
                    delay = min(5.0, 1.0 * (2**attempt))
                    logger.warning(
                        "Tagger: rate limit backoff %.1fs for %s (attempt %s/2)",
                        delay,
                        symbol,
                        attempt + 1,
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error(
                    "Failed to classify %s: %s",
                    symbol,
                    type(e).__name__,
                    exc_info=True,
                )
                break
        if last_exc is not None and symbol not in [r.symbol for r in results]:
            logger.warning("Tagger: skipping %s after failed attempts", symbol)

    return results, None


def classification_to_db_format(classification: InstrumentClassification) -> InstrumentCreate:
    """Convert classification to database format."""
    asset_class_dict = {
        "equity": classification.allocation_asset_class.equity,
        "fixed_income": classification.allocation_asset_class.fixed_income,
        "real_estate": classification.allocation_asset_class.real_estate,
        "commodities": classification.allocation_asset_class.commodities,
        "cash": classification.allocation_asset_class.cash,
        "alternatives": classification.allocation_asset_class.alternatives,
    }
    asset_class_dict = {k: v for k, v in asset_class_dict.items() if v > 0}

    regions_dict = {
        "north_america": classification.allocation_regions.north_america,
        "europe": classification.allocation_regions.europe,
        "asia": classification.allocation_regions.asia,
        "latin_america": classification.allocation_regions.latin_america,
        "africa": classification.allocation_regions.africa,
        "middle_east": classification.allocation_regions.middle_east,
        "oceania": classification.allocation_regions.oceania,
        "global": classification.allocation_regions.global_,
        "international": classification.allocation_regions.international,
    }
    regions_dict = {k: v for k, v in regions_dict.items() if v > 0}

    sectors_dict = {
        "technology": classification.allocation_sectors.technology,
        "healthcare": classification.allocation_sectors.healthcare,
        "financials": classification.allocation_sectors.financials,
        "consumer_discretionary": classification.allocation_sectors.consumer_discretionary,
        "consumer_staples": classification.allocation_sectors.consumer_staples,
        "industrials": classification.allocation_sectors.industrials,
        "materials": classification.allocation_sectors.materials,
        "energy": classification.allocation_sectors.energy,
        "utilities": classification.allocation_sectors.utilities,
        "real_estate": classification.allocation_sectors.real_estate,
        "communication": classification.allocation_sectors.communication,
        "treasury": classification.allocation_sectors.treasury,
        "corporate": classification.allocation_sectors.corporate,
        "mortgage": classification.allocation_sectors.mortgage,
        "government_related": classification.allocation_sectors.government_related,
        "commodities": classification.allocation_sectors.commodities,
        "diversified": classification.allocation_sectors.diversified,
        "other": classification.allocation_sectors.other,
    }
    sectors_dict = {k: v for k, v in sectors_dict.items() if v > 0}

    return InstrumentCreate(
        symbol=classification.symbol,
        name=classification.name,
        instrument_type=classification.instrument_type,  # type: ignore[arg-type]
        current_price=Decimal(str(classification.current_price)),
        allocation_asset_class=asset_class_dict,
        allocation_regions=regions_dict,
        allocation_sectors=sectors_dict,
    )
