"""
Idempotent first-login provisioning: ``users`` row + at least one default ``accounts`` row.

Single source of truth for new Clerk subjects so downstream FKs and portfolio routes never see a missing user.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)


def provision_user_session(db: Any, clerk_user_id: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]], Dict[str, bool]]:
    """
    Ensure DB state is ready for portfolio APIs.

    Returns ``(user_row, accounts, flags)`` where ``flags`` contains
    ``created_user`` and ``created_default_account``.
    """
    flags = {"created_user": False, "created_default_account": False}

    row: Dict[str, Any] | None = db.users.find_by_clerk_id(clerk_user_id)
    if not row:
        try:
            db.users.create_user(clerk_user_id)
            flags["created_user"] = True
        except Exception:
            logger.warning(
                "onboarding: user insert may have raced clerk_user_id=%s",
                clerk_user_id[:10],
                exc_info=True,
            )
        row = db.users.find_by_clerk_id(clerk_user_id)
    if not row:
        raise RuntimeError("User provisioning failed: could not load or create users row")

    accounts: List[Dict[str, Any]] = db.accounts.find_by_user(clerk_user_id)
    if not accounts:
        db.accounts.create_account(
            clerk_user_id=clerk_user_id,
            account_name="Primary portfolio",
            account_purpose="Created automatically on first sign-in",
            cash_balance=Decimal("0"),
        )
        flags["created_default_account"] = True
        accounts = db.accounts.find_by_user(clerk_user_id)

    return row, accounts, flags
