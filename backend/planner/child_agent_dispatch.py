"""
In-process execution of child agent Lambda handlers (local / fallback).

Each agent package expects its directory on ``sys.path`` for sibling imports
(``from agent import ...``, ``from templates import ...``, ``from judge import ...``).
"""

from __future__ import annotations

import asyncio
import contextlib
import importlib.util
import logging
import sys
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_MODULE_CACHE: dict[str, Any] = {}


@contextlib.contextmanager
def _prepend_sys_path(path: str) -> Any:
    sys.path.insert(0, path)
    try:
        yield
    finally:
        try:
            sys.path.remove(path)
        except ValueError:
            pass


def logical_agent_to_package(logical: str) -> str:
    key = logical.strip().lower()
    if key in ("reporter", "researcher"):
        return "reporter"
    if key == "tagger":
        return "tagger"
    if key == "charter":
        return "charter"
    if key == "retirement":
        return "retirement"
    raise ValueError(f"Unknown agent for local dispatch: {logical!r}")


def _load_lambda_handler_module(pkg: str) -> Any:
    if pkg in _MODULE_CACHE:
        return _MODULE_CACHE[pkg]
    agent_dir = str(_BACKEND_ROOT / pkg)
    path = _BACKEND_ROOT / pkg / "lambda_handler.py"
    if not path.is_file():
        raise FileNotFoundError(
            f"No lambda_handler at {path}. "
            "For the SQS worker image, COPY each agent tree to /var/task/<agent>/ "
            "(see apps/api/Dockerfile.worker)."
        )
    name = f"alex_local_dispatch_{pkg}"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    # Child packages use sibling imports (``agent``, ``templates``, ``judge``).
    # Earlier in-process loads leave those names in ``sys.modules`` → must not shadow
    # another child's modules during exec (e.g. reporter ``templates`` vs charter).
    saved_agent = sys.modules.pop("agent", None)
    saved_templates = sys.modules.pop("templates", None)
    saved_judge = sys.modules.pop("judge", None)
    try:
        with _prepend_sys_path(agent_dir):
            spec.loader.exec_module(mod)
    finally:
        if saved_agent is not None:
            sys.modules["agent"] = saved_agent
        else:
            sys.modules.pop("agent", None)
        if saved_templates is not None:
            sys.modules["templates"] = saved_templates
        else:
            sys.modules.pop("templates", None)
        if saved_judge is not None:
            sys.modules["judge"] = saved_judge
        else:
            sys.modules.pop("judge", None)
    if not hasattr(mod, "lambda_handler"):
        raise AttributeError(f"{path} has no lambda_handler")
    _MODULE_CACHE[pkg] = mod
    return mod


async def run_child_lambda_handler_locally(logical_agent: str, event: Dict[str, Any]) -> Any:
    """Run the packaged Lambda entry synchronously in a worker thread (asyncio-safe)."""
    pkg = logical_agent_to_package(logical_agent)
    jid = event.get("job_id") if isinstance(event, dict) else None
    log_key = logical_agent.strip().lower()
    logger.info("[AGENT START] %s job_id=%s mode=in_process_handler", log_key, jid)
    mod = _load_lambda_handler_module(pkg)
    agent_dir = str(_BACKEND_ROOT / pkg)

    def _call() -> Any:
        with _prepend_sys_path(agent_dir):
            return mod.lambda_handler(event, None)

    try:
        out = await asyncio.to_thread(_call)
        logger.info("[AGENT DONE] %s job_id=%s mode=in_process_handler", log_key, jid)
        return out
    except Exception:
        logger.exception("[AGENT FAIL] %s job_id=%s mode=in_process_handler", log_key, jid)
        raise
