"""
Report Writer Agent - generates portfolio analysis narratives.
"""

import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from agents import RunContextWrapper, function_tool

from alex_llm.embeddings import embed_text
from alex_llm.llm import get_llm, litellm_openrouter_model

logger = logging.getLogger()


@dataclass
class ReporterContext:
    """Context for the Reporter agent"""

    job_id: str
    portfolio_data: Dict[str, Any]
    user_data: Dict[str, Any]
    db: Optional[Any] = None  # Database connection (optional for testing)


def calculate_portfolio_metrics(portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate basic portfolio metrics."""
    metrics = {
        "total_value": 0,
        "cash_balance": 0,
        "num_accounts": len(portfolio_data.get("accounts", [])),
        "num_positions": 0,
        "unique_symbols": set(),
    }

    for account in portfolio_data.get("accounts", []):
        metrics["cash_balance"] += float(account.get("cash_balance", 0))
        positions = account.get("positions", [])
        metrics["num_positions"] += len(positions)

        for position in positions:
            symbol = position.get("symbol")
            if symbol:
                metrics["unique_symbols"].add(symbol)

            # Calculate value if we have price
            instrument = position.get("instrument", {})
            if instrument.get("current_price"):
                value = float(position.get("quantity", 0)) * float(instrument["current_price"])
                metrics["total_value"] += value

    metrics["total_value"] += metrics["cash_balance"]
    metrics["unique_symbols"] = len(metrics["unique_symbols"])

    return metrics


def format_portfolio_for_analysis(portfolio_data: Dict[str, Any], user_data: Dict[str, Any]) -> str:
    """Format portfolio data for agent analysis."""
    metrics = calculate_portfolio_metrics(portfolio_data)

    lines = [
        f"Portfolio Overview:",
        f"- {metrics['num_accounts']} accounts",
        f"- {metrics['num_positions']} total positions",
        f"- {metrics['unique_symbols']} unique holdings",
        f"- ${metrics['cash_balance']:,.2f} in cash",
        f"- ${metrics['total_value']:,.2f} total value" if metrics["total_value"] > 0 else "",
        "",
        "Account Details:",
    ]

    for account in portfolio_data.get("accounts", []):
        name = account.get("name", "Unknown")
        cash = float(account.get("cash_balance", 0))
        lines.append(f"\n{name} (${cash:,.2f} cash):")

        for position in account.get("positions", []):
            symbol = position.get("symbol")
            quantity = float(position.get("quantity", 0))
            instrument = position.get("instrument", {})
            name = instrument.get("name", "")

            # Include allocation info if available
            allocations = []
            if instrument.get("asset_class"):
                allocations.append(f"Asset: {instrument['asset_class']}")
            if instrument.get("regions"):
                regions = ", ".join(
                    [f"{r['name']} {r['percentage']}%" for r in instrument["regions"][:2]]
                )
                allocations.append(f"Regions: {regions}")

            alloc_str = f" ({', '.join(allocations)})" if allocations else ""
            lines.append(f"  - {symbol}: {quantity:,.2f} shares{alloc_str}")

    # Add user context
    lines.extend(
        [
            "",
            "User Profile:",
            f"- Years to retirement: {user_data.get('years_until_retirement', 'Not specified')}",
            f"- Target retirement income: ${user_data.get('target_retirement_income', 0):,.0f}/year",
        ]
    )

    return "\n".join(lines)


# update_report tool removed - report is now saved directly in lambda_handler


@function_tool
async def get_market_insights(
    wrapper: RunContextWrapper[ReporterContext], symbols: List[str]
) -> str:
    """
    Retrieve market context from Supabase pgvector (document_embeddings).

    Args:
        wrapper: Context wrapper with job_id and database
        symbols: List of symbols to get insights for

    Returns:
        Relevant market context and insights
    """
    try:
        db = wrapper.context.db
        if not db:
            return "Market insights unavailable (no database in context)."
        job = db.jobs.find_by_id(wrapper.context.job_id)
        if not job:
            return "Market insights unavailable (job not found)."
        user_id = job["clerk_user_id"]
        query = f"market analysis {' '.join(symbols[:5])}" if symbols else "market outlook"
        vec = embed_text(query)
        rows = db.embeddings.search_similar(user_id, vec, 5)
        if not rows:
            return "No similar research snippets indexed yet for this user."
        lines = []
        for row in rows:
            content = row.get("content") or ""
            meta = row.get("metadata") or {}
            title = meta.get("title") or meta.get("company_name") or ""
            prefix = f"{title}: " if title else ""
            lines.append(f"{prefix}{content[:280]}")
        return "Market Insights:\n" + "\n".join(lines)
    except Exception as e:
        logger.warning("Reporter: Could not retrieve market insights: %s", e)
        return "Market insights unavailable - proceeding with standard analysis."


def create_agent(
    job_id: str,
    portfolio_data: Dict[str, Any],
    user_data: Dict[str, Any],
    db=None,
    *,
    model_slug: str | None = None,
):
    """Create the reporter agent with tools and context."""

    model = litellm_openrouter_model(model_slug) if model_slug else get_llm("reasoning")

    # Create context
    context = ReporterContext(
        job_id=job_id, portfolio_data=portfolio_data, user_data=user_data, db=db
    )

    # Tools - only get_market_insights now, report saved in lambda_handler
    tools = [get_market_insights]

    # Format portfolio for analysis
    portfolio_summary = format_portfolio_for_analysis(portfolio_data, user_data)

    # Create task
    task = f"""Analyze this investment portfolio and write a comprehensive report.

{portfolio_summary}

Your task:
1. First, get market insights for the top holdings using get_market_insights()
2. Analyze the portfolio's current state, strengths, and weaknesses
3. Generate a detailed, professional analysis report in markdown format

The report should include:
- Executive Summary
- Portfolio Composition Analysis
- Risk Assessment
- Diversification Analysis
- Retirement Readiness (based on user goals)
- Recommendations
- Market Context (from insights)

Provide your complete analysis as the final output in clear markdown format.
Make the report informative yet accessible to a retail investor."""

    return model, tools, task, context
