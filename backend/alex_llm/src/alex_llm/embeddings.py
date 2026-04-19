"""Text embeddings via OpenRouter (OpenAI-compatible embeddings API)."""

from __future__ import annotations

import json
import os
import urllib.request
from typing import List


def embed_text(text: str) -> List[float]:
    """
    Create an embedding vector for semantic search (pgvector).

    Env:
      OPENROUTER_API_KEY
      OR_MODEL_EMBEDDING (optional, default openai/text-embedding-3-small)
    """
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise ValueError("OPENROUTER_API_KEY is required for embeddings.")
    model = os.getenv("OR_MODEL_EMBEDDING", "openai/text-embedding-3-small").strip()
    body = json.dumps({"model": model, "input": text}).encode("utf-8")
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/embeddings",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return payload["data"][0]["embedding"]
