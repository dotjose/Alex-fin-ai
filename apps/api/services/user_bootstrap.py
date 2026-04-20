"""Ensure a `users` row exists for a Clerk-authenticated subject."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def ensure_user_row(db: Any, clerk_user_id: str) -> Dict[str, Any]:
    """
    Return the user row, creating a minimal profile if missing.

    Production flows often hit POST /api/accounts or POST /api/analyze before any PUT /api/user,
    so the DB row must exist to satisfy FK on accounts / jobs.
    """
    row: Optional[Dict[str, Any]] = db.users.find_by_clerk_id(clerk_user_id)
    if row:
        return row
    logger.info("user_bootstrap: creating missing users row clerk_user_id=%s", clerk_user_id[:8] + "…")
    db.users.create_user(clerk_user_id)
    row = db.users.find_by_clerk_id(clerk_user_id)
    if not row:
        raise RuntimeError("User provisioning failed after insert")
    return row
