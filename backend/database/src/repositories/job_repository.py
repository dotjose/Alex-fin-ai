from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client

from ._serialize import json_safe

_log = logging.getLogger(__name__)


class JobRepository:
    table = "jobs"

    def __init__(self, client: Client):
        self._sb = client
        self._t = client.table(self.table)

    def find_by_id(self, job_id: str) -> Optional[Dict[str, Any]]:
        r = self._t.select("*").eq("id", job_id).limit(1).execute()
        if r.data:
            return r.data[0]
        return None

    def create_job(
        self, clerk_user_id: str, job_type: str, request_payload: Dict[str, Any] | None
    ) -> str:
        row = json_safe(
            {
                "clerk_user_id": clerk_user_id,
                "job_type": job_type,
                "status": "pending",
                "request_payload": request_payload or {},
            }
        )
        r = self._t.insert(row).execute()
        if not r.data:
            raise RuntimeError("insert job returned no row")
        return r.data[0]["id"]

    def create(self, data: Dict[str, Any]) -> str:
        """Insert job from a dict (tests / internal)."""
        row = json_safe(data)
        r = self._t.insert(row).execute()
        if not r.data:
            raise RuntimeError("insert job returned no row")
        return r.data[0]["id"]

    def update_status(self, job_id: str, status: str, error_message: str | None = None) -> int:
        data: Dict[str, Any] = {"status": status}
        now = datetime.now(timezone.utc).isoformat()
        if status == "running":
            data["started_at"] = now
        elif status in ("completed", "failed"):
            data["completed_at"] = now
        if error_message:
            data["error_message"] = error_message
        _log.info(
            "jobs.update_status job_id=%s status=%s has_error_message=%s",
            job_id,
            status,
            bool(error_message),
        )
        self._t.update(json_safe(data)).eq("id", job_id).execute()
        return 1

    def update_report(self, job_id: str, report_payload: Dict[str, Any]) -> int:
        self._t.update({"report_payload": report_payload}).eq("id", job_id).execute()
        return 1

    def update_charts(self, job_id: str, charts_payload: Dict[str, Any]) -> int:
        self._t.update({"charts_payload": charts_payload}).eq("id", job_id).execute()
        return 1

    def update_retirement(self, job_id: str, retirement_payload: Dict[str, Any]) -> int:
        self._t.update({"retirement_payload": retirement_payload}).eq("id", job_id).execute()
        return 1

    def update_summary(self, job_id: str, summary_payload: Dict[str, Any]) -> int:
        self._t.update({"summary_payload": summary_payload}).eq("id", job_id).execute()
        return 1

    def merge_orch(self, job_id: str, *, trace_id: str | None = None, pipeline: Dict[str, Any] | None = None) -> None:
        """
        Merge orchestration metadata into ``request_payload._orch`` for UI + tracing.
        ``pipeline`` keys are agent names (planner, tagger, reporter, charter, retirement).
        """
        row = self.find_by_id(job_id)
        if not row:
            return
        base = dict(row.get("request_payload") or {})
        orch = dict(base.get("_orch") or {})
        if trace_id:
            orch["trace_id"] = str(trace_id).strip()
        if pipeline:
            pl = dict(orch.get("pipeline") or {})
            for agent, step in pipeline.items():
                if not isinstance(step, dict):
                    pl[str(agent)] = step
                    continue
                prev = pl.get(str(agent))
                if isinstance(prev, dict):
                    merged = {**prev, **step}
                    pl[str(agent)] = merged
                else:
                    pl[str(agent)] = dict(step)
            orch["pipeline"] = pl
        base["_orch"] = orch
        _log.info(
            "jobs.merge_orch job_id=%s trace_id=%s pipeline_patch=%s",
            job_id,
            trace_id,
            list(pipeline.keys()) if pipeline else None,
        )
        self._t.update(json_safe({"request_payload": base})).eq("id", job_id).execute()

    def find_all(self, limit: int = 100) -> List[Dict[str, Any]]:
        r = self._t.select("*").order("created_at", desc=True).limit(limit).execute()
        return r.data or []

    def find_by_user(
        self, clerk_user_id: str, status: str | None = None, limit: int = 20
    ) -> List[Dict[str, Any]]:
        q = self._t.select("*").eq("clerk_user_id", clerk_user_id)
        if status:
            q = q.eq("status", status)
        r = q.order("created_at", desc=True).limit(limit).execute()
        return r.data or []
