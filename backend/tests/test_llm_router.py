import os

import pytest

from alex_llm.llm import get_llm


def test_get_llm_requires_env(monkeypatch):
    monkeypatch.delenv("OR_MODEL_REASONING", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(ValueError):
        get_llm("reasoning")


def test_get_llm_builds_openrouter_model(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setenv("OR_MODEL_REASONING", "anthropic/claude-3.5-sonnet")
    m = get_llm("reasoning")
    assert "openrouter/" in str(m.model)
