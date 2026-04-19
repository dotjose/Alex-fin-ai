"""
SQS / planner worker entry: load legacy planner package from ./planner (copied at image build).
"""

from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent
_planner = _root / "planner"
if not _planner.is_dir():
    # Repo layout: <repo>/apps/api/planner_entry.py → planner lives at <repo>/backend/planner
    _repo_root = _root.parent.parent
    _fallback = _repo_root / "backend" / "planner"
    if _fallback.is_dir():
        _planner = _fallback
if _planner.is_dir() and str(_planner) not in sys.path:
    sys.path.insert(0, str(_planner))

from lambda_handler import lambda_handler as handler  # noqa: E402
