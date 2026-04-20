"""Compatibility shim — use ``services.onboarding``."""

from __future__ import annotations

from typing import Any, Dict

from services.onboarding import provision_user_session


def ensure_user_row(db: Any, clerk_user_id: str) -> Dict[str, Any]:
    """Return the user row, provisioning user + default account if needed."""
    user, _, _ = provision_user_session(db, clerk_user_id)
    return user
