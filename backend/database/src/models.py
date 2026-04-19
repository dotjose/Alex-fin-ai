"""Database façade: Supabase-backed repositories (PostgREST + service role)."""

from __future__ import annotations

from .repositories._client import get_service_client
from .repositories.account_repository import AccountRepository
from .repositories.embedding_repository import EmbeddingRepository
from .repositories.instrument_repository import InstrumentRepository
from .repositories.job_repository import JobRepository
from .repositories.position_repository import PositionRepository
from .repositories.user_repository import UserRepository


class Database:
    """Application database access via Supabase."""

    def __init__(self) -> None:
        sb = get_service_client()
        self.users = UserRepository(sb)
        self.accounts = AccountRepository(sb)
        self.positions = PositionRepository(sb)
        self.instruments = InstrumentRepository(sb)
        self.jobs = JobRepository(sb)
        self.embeddings = EmbeddingRepository(sb)
