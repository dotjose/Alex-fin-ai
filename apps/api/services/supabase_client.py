"""Supabase-backed Database façade (alex-database)."""

from __future__ import annotations

from functools import lru_cache

from src import Database


@lru_cache
def get_database() -> Database:
    return Database()
