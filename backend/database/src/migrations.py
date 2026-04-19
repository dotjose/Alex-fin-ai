"""Idempotent SQL migrations (Postgres wire — not the Supabase REST client)."""

from __future__ import annotations

import logging
from pathlib import Path

import psycopg

logger = logging.getLogger(__name__)


def migrations_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "migrations"


def _ensure_tracking_table(conn: psycopg.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )


def run_pending_migrations(database_url: str) -> None:
    """Apply each `*.sql` in ``migrations/`` once, in sorted order."""
    dsn = (database_url or "").strip()
    if not dsn:
        raise RuntimeError(
            "SUPABASE_DATABASE_URL is not set. Use the Postgres connection string from "
            "Supabase → Project Settings → Database (URI). This is only for migrations; "
            "SUPABASE_URL remains the https://<ref>.supabase.co REST base URL."
        )

    folder = migrations_dir()
    if not folder.is_dir():
        raise RuntimeError(f"Migrations directory missing: {folder}")

    sql_files = sorted(p for p in folder.glob("*.sql") if p.is_file())
    if not sql_files:
        logger.warning("No .sql migrations in %s — skipping", folder)
        return

    with psycopg.connect(dsn, autocommit=True) as conn:
        _ensure_tracking_table(conn)

    for path in sql_files:
        version = path.stem
        sql = path.read_text(encoding="utf-8").strip()
        if not sql:
            continue

        with psycopg.connect(dsn) as conn:
            row = conn.execute(
                "SELECT 1 FROM schema_migrations WHERE version = %s", (version,)
            ).fetchone()
            if row:
                logger.info("Migration already applied: %s", version)
                continue

            logger.info("Applying migration: %s", version)
            try:
                with conn.transaction():
                    conn.execute(sql)
                    conn.execute(
                        "INSERT INTO schema_migrations (version) VALUES (%s)",
                        (version,),
                    )
            except Exception as e:
                logger.exception("Migration failed: %s", version)
                raise RuntimeError(f"Migration '{version}' failed: {e}") from e

            logger.info("Migration applied: %s", version)


CORE_TABLES = ("users", "accounts", "positions", "jobs")


def warn_if_core_tables_missing(database_url: str) -> None:
    """
    After migrations, log WARNING if expected public tables are absent (e.g. wrong DB
    or migrations skipped). Does not raise — avoids crashing a partially configured dev API.
    """
    dsn = (database_url or "").strip()
    if not dsn:
        return
    try:
        with psycopg.connect(dsn, autocommit=True) as conn:
            for table in CORE_TABLES:
                row = conn.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = %s
                    )
                    """,
                    (table,),
                ).fetchone()
                if row and not row[0]:
                    logger.warning(
                        "Schema check: table public.%s is missing — "
                        "PostgREST may return PGRST205. Verify SUPABASE_DATABASE_URL "
                        "points at the same project as SUPABASE_URL and migrations ran.",
                        table,
                    )
    except Exception as e:
        logger.warning("Schema check skipped (non-fatal): %s", e)
