"""
Alex Researcher Service - Investment Advice Agent
"""

import os
import logging
from datetime import datetime, UTC
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment before importing openai-agents (trace provider reads env at import time).
load_dotenv(override=True)
os.environ.setdefault("OPENAI_AGENTS_DISABLE_TRACING", "true")

from agents import Agent, Runner, trace
from agents.extensions.models.litellm_model import LitellmModel

# Suppress LiteLLM warnings about optional dependencies
logging.getLogger("LiteLLM").setLevel(logging.CRITICAL)

# Import from our modules
from context import get_agent_instructions, DEFAULT_RESEARCH_PROMPT
from mcp_servers import create_playwright_mcp_server
from tools import ingest_financial_document

app = FastAPI(title="Alex Researcher Service")


# Request model
class ResearchRequest(BaseModel):
    topic: Optional[str] = None  # Optional - if not provided, agent picks a topic


async def run_research_agent(topic: str = None) -> str:
    """Run the research agent to generate investment advice."""

    # Prepare the user query
    if topic:
        query = f"Research this investment topic: {topic}"
    else:
        query = DEFAULT_RESEARCH_PROMPT

    region = (
        os.getenv("AWS_REGION")
        or os.getenv("AWS_DEFAULT_REGION")
        or "us-east-1"
    ).strip()
    os.environ.setdefault("AWS_REGION_NAME", region)
    os.environ.setdefault("AWS_REGION", region)
    os.environ.setdefault("AWS_DEFAULT_REGION", region)

    slug = (os.getenv("OR_MODEL_REASONING") or os.getenv("OR_MODEL_FAST") or "").strip()
    if not slug:
        raise ValueError(
            "Set OR_MODEL_REASONING (or OR_MODEL_FAST) and OPENROUTER_API_KEY for OpenRouter."
        )
    model = LitellmModel(model=f"openrouter/{slug}")

    # Create and run the agent with MCP server
    with trace("Researcher"):
        async with create_playwright_mcp_server(timeout_seconds=60) as playwright_mcp:
            agent = Agent(
                name="Alex Investment Researcher",
                instructions=get_agent_instructions(),
                model=model,
                tools=[ingest_financial_document],
                mcp_servers=[playwright_mcp],
            )

            result = await Runner.run(agent, input=query, max_turns=15)

    return result.final_output


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "Alex Researcher",
        "status": "healthy",
        "timestamp": datetime.now(UTC).isoformat(),
    }


@app.post("/research")
async def research(request: ResearchRequest) -> str:
    """
    Generate investment research and advice.

    The agent will:
    1. Browse current financial websites for data
    2. Analyze the information found
    3. Store the analysis in the knowledge base

    If no topic is provided, the agent will pick a trending topic.
    """
    try:
        response = await run_research_agent(request.topic)
        return response
    except Exception as e:
        print(f"Error in research endpoint: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/research/auto")
async def research_auto():
    """
    Automated research endpoint for scheduled runs.
    Picks a trending topic automatically and generates research.
    Used by EventBridge Scheduler for periodic research updates.
    """
    try:
        # Always use agent's choice for automated runs
        response = await run_research_agent(topic=None)
        return {
            "status": "success",
            "timestamp": datetime.now(UTC).isoformat(),
            "message": "Automated research completed",
            "preview": response[:200] + "..." if len(response) > 200 else response,
        }
    except Exception as e:
        print(f"Error in automated research: {e}")
        return {"status": "error", "timestamp": datetime.now(UTC).isoformat(), "error": str(e)}


@app.get("/health")
async def health():
    """Detailed health check."""
    # Debug container detection
    container_indicators = {
        "dockerenv": os.path.exists("/.dockerenv"),
        "containerenv": os.path.exists("/run/.containerenv"),
        "aws_execution_env": os.environ.get("AWS_EXECUTION_ENV", ""),
        "ecs_container_metadata": os.environ.get("ECS_CONTAINER_METADATA_URI", ""),
        "kubernetes_service": os.environ.get("KUBERNETES_SERVICE_HOST", ""),
    }

    return {
        "service": "Alex Researcher",
        "status": "healthy",
        "alex_api_configured": bool(os.getenv("ALEX_API_ENDPOINT") and os.getenv("ALEX_API_KEY")),
        "timestamp": datetime.now(UTC).isoformat(),
        "debug_container": container_indicators,
        "aws_region": os.environ.get("AWS_DEFAULT_REGION", "not set"),
        "openrouter_model": os.getenv("OR_MODEL_REASONING") or os.getenv("OR_MODEL_FAST") or "not set",
    }


@app.get("/test-bedrock")
async def test_bedrock():
    """Compatibility route: exercises OpenRouter via LiteLLM (Bedrock removed)."""
    try:
        region = (
            os.getenv("AWS_REGION")
            or os.getenv("AWS_DEFAULT_REGION")
            or "us-east-1"
        ).strip()
        os.environ.setdefault("AWS_REGION_NAME", region)
        slug = (os.getenv("OR_MODEL_REASONING") or os.getenv("OR_MODEL_FAST") or "").strip()
        if not slug:
            return {"status": "error", "detail": "OR_MODEL_REASONING or OR_MODEL_FAST must be set"}

        model = LitellmModel(model=f"openrouter/{slug}")

        agent = Agent(
            name="Test Agent",
            instructions="You are a helpful assistant. Be very brief.",
            model=model,
        )

        result = await Runner.run(agent, input="Say hello in 5 words or less", max_turns=1)

        return {
            "status": "success",
            "model": str(model.model),
            "region": region,
            "response": result.final_output,
            "provider": "openrouter",
        }
    except Exception as e:
        import traceback

        return {
            "status": "error",
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc(),
            "debug": {
                "env_vars": {
                    "AWS_REGION_NAME": os.environ.get("AWS_REGION_NAME"),
                    "AWS_REGION": os.environ.get("AWS_REGION"),
                    "AWS_DEFAULT_REGION": os.environ.get("AWS_DEFAULT_REGION"),
                },
            },
        }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
