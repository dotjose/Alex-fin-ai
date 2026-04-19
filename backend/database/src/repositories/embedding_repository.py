"""pgvector-backed embeddings via Supabase RPC + table `document_embeddings`."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Sequence

from supabase import Client

from ._serialize import json_safe

logger = logging.getLogger(__name__)


class EmbeddingRepository:
    table = "document_embeddings"

    def __init__(self, client: Client):
        self._sb = client
        self._t = client.table(self.table)

    def store_embeddings(
        self,
        clerk_user_id: str,
        rows: Sequence[Dict[str, Any]],
    ) -> None:
        """
        rows: each dict may contain content, embedding (list[float]), metadata (dict)
        """
        batch: List[Dict[str, Any]] = []
        for r in rows:
            batch.append(
                json_safe(
                    {
                        "clerk_user_id": clerk_user_id,
                        "content": r.get("content", ""),
                        "embedding": r.get("embedding"),
                        "metadata": r.get("metadata") or {},
                    }
                )
            )
        if not batch:
            return
        self._t.insert(batch).execute()

    def search_similar(
        self,
        clerk_user_id: str,
        query_embedding: List[float],
        match_count: int = 5,
    ) -> List[Dict[str, Any]]:
        try:
            resp = self._sb.rpc(
                "match_document_embeddings",
                {
                    "filter_user": clerk_user_id,
                    "query_embedding": query_embedding,
                    "match_count": match_count,
                },
            ).execute()
            return resp.data or []
        except Exception as e:
            logger.warning("Vector search failed (migration / RPC missing?): %s", e)
            return []
