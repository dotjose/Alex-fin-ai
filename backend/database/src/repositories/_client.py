"""Singleton Supabase service client (service role — backend only)."""

from __future__ import annotations

import os
import threading

from supabase import Client, create_client

_lock = threading.Lock()
_client: Client | None = None


def get_service_client() -> Client:
    global _client
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if url.lower().startswith(("postgres://", "postgresql://")):
        raise ValueError(
            "SUPABASE_URL must be the https://<ref>.supabase.co REST URL, not a Postgres URI. "
            "Use SUPABASE_DATABASE_URL for direct Postgres access (migrations only)."
        )
    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for database access. "
            "Ensure the API process loads the repository root .env (see apps/api/core/config.py) "
            "and both variables are non-empty."
        )
    with _lock:
        if _client is None:
            _client = create_client(url, key)
        return _client
