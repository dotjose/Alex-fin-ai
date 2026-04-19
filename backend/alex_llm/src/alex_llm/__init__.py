"""Shared LLM + embedding utilities (OpenRouter)."""

from .embeddings import embed_text
from .llm import get_llm, litellm_openrouter_model, openrouter_fallback_slug
from .openrouter_resilience import (
    LLM_ERROR,
    LLM_PROVIDER_UNAVAILABLE,
    exception_is_litellm_rate_limit,
    exception_is_provider_unavailable,
    log_llm_provider_outage,
    provider_unavailable_response,
    short_llm_error_message,
)
from .lambda_observability import (
    debug_agent_flow_enabled,
    debug_agent_system_enabled,
    log_lambda_agent_start,
    verbose_observability_enabled,
)
from .tracing import (
    attach_trace_to_lambda_payload,
    new_trace_id_hex32,
    normalize_trace_context,
    observe_agent,
    root_trace_context_from_seed,
)

__all__ = [
    "get_llm",
    "litellm_openrouter_model",
    "openrouter_fallback_slug",
    "LLM_PROVIDER_UNAVAILABLE",
    "LLM_ERROR",
    "exception_is_provider_unavailable",
    "exception_is_litellm_rate_limit",
    "log_llm_provider_outage",
    "provider_unavailable_response",
    "short_llm_error_message",
    "embed_text",
    "observe_agent",
    "normalize_trace_context",
    "root_trace_context_from_seed",
    "new_trace_id_hex32",
    "attach_trace_to_lambda_payload",
    "debug_agent_flow_enabled",
    "debug_agent_system_enabled",
    "verbose_observability_enabled",
    "log_lambda_agent_start",
]
