"""
Database package for Alex Financial Planner (Supabase / pgvector).
"""

from .migrations import run_pending_migrations, warn_if_core_tables_missing
from .models import Database
from .schemas import (
    RegionType,
    AssetClassType,
    SectorType,
    InstrumentType,
    JobType,
    JobStatus,
    AccountType,
    InstrumentCreate,
    UserCreate,
    AccountCreate,
    PositionCreate,
    JobCreate,
    JobUpdate,
    InstrumentResponse,
    PortfolioAnalysis,
    RebalanceRecommendation,
)

__all__ = [
    "Database",
    "run_pending_migrations",
    "warn_if_core_tables_missing",
    "InstrumentCreate",
    "UserCreate",
    "AccountCreate",
    "PositionCreate",
    "JobCreate",
    "JobUpdate",
    "InstrumentResponse",
    "PortfolioAnalysis",
    "RebalanceRecommendation",
    "RegionType",
    "AssetClassType",
    "SectorType",
    "InstrumentType",
    "JobType",
    "JobStatus",
    "AccountType",
]
