"""
Central OpenRouter routing for all agents (OpenAI Agents SDK + LiteLLM).
"""

from __future__ import annotations

import os
from typing import Literal

from agents.extensions.models.litellm_model import LitellmModel

ModelTier = Literal["fast", "reasoning", "simple"]

_ENV_KEYS: dict[ModelTier, str] = {
    "simple": "OR_MODEL_SIMPLE",
    "fast": "OR_MODEL_FAST",
    "reasoning": "OR_MODEL_REASONING",
}


def get_llm(model_type: ModelTier) -> LitellmModel:
    """
    Return a LitellmModel pointing at OpenRouter.

    Env:
      OPENROUTER_API_KEY (required)
      OR_MODEL_SIMPLE, OR_MODEL_FAST, OR_MODEL_REASONING (OpenRouter model slugs, no prefix)
    """
    env_key = _ENV_KEYS[model_type]
    model_slug = os.getenv(env_key, "").strip()
    if not model_slug:
        raise ValueError(
            f"Missing {env_key} for OpenRouter model mapping (model_type={model_type!r})."
        )
    if not os.getenv("OPENROUTER_API_KEY"):
        raise ValueError("OPENROUTER_API_KEY is required for LLM calls.")
    return LitellmModel(model=f"openrouter/{model_slug}")


def litellm_openrouter_model(slug: str) -> LitellmModel:
    """
    Build a ``LitellmModel`` for an explicit OpenRouter slug (used for fallback routing).

    ``slug`` is the part after ``openrouter/`` (same as ``OR_MODEL_*`` values).
    """
    raw = (slug or "").strip()
    if not raw:
        raise ValueError("OpenRouter model slug is empty.")
    if not os.getenv("OPENROUTER_API_KEY"):
        raise ValueError("OPENROUTER_API_KEY is required for LLM calls.")
    return LitellmModel(model=f"openrouter/{raw}")


def openrouter_fallback_slug(model_type: ModelTier) -> str | None:
    """Optional per-tier or global fallback slug (no ``openrouter/`` prefix)."""
    tier_key = f"{_ENV_KEYS[model_type]}_FALLBACK"
    for key in (tier_key, "OR_MODEL_FALLBACK"):
        v = (os.getenv(key) or "").strip()
        if v:
            return v
    return None
