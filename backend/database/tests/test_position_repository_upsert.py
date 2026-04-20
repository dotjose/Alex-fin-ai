"""Regression: upsert must not chain .select() (postgrest-py SyncQueryRequestBuilder)."""

from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

from src.repositories.position_repository import PositionRepository


def test_add_position_calls_upsert_with_returning_and_execute():
    execute_result = SimpleNamespace(data=[{"id": "550e8400-e29b-41d4-a716-446655440000"}])

    upsert_builder = MagicMock()
    upsert_builder.execute.return_value = execute_result

    table = MagicMock()
    table.upsert.return_value = upsert_builder

    client = MagicMock()
    client.table.return_value = table

    repo = PositionRepository(client)
    pid = repo.add_position(
        account_id="660e8400-e29b-41d4-a716-446655440001",
        symbol="AAPL",
        quantity=Decimal("1.5"),
    )

    assert pid == "550e8400-e29b-41d4-a716-446655440000"
    table.upsert.assert_called_once()
    kwargs = table.upsert.call_args.kwargs
    assert kwargs.get("on_conflict") == "account_id,symbol"
    assert "returning" in kwargs
    upsert_builder.select.assert_not_called()
    upsert_builder.execute.assert_called_once()


def test_add_position_fallback_select_when_upsert_returns_empty():
    empty_then_id = [
        SimpleNamespace(data=[]),
        SimpleNamespace(data=[{"id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"}]),
    ]

    upsert_builder = MagicMock()
    upsert_builder.execute.return_value = empty_then_id[0]

    select_builder = MagicMock()
    select_builder.eq.return_value = select_builder
    select_builder.limit.return_value = select_builder
    select_builder.execute.return_value = empty_then_id[1]

    table = MagicMock()
    table.upsert.return_value = upsert_builder
    table.select.return_value = select_builder

    client = MagicMock()
    client.table.return_value = table

    repo = PositionRepository(client)
    pid = repo.add_position(
        account_id="6ba7b811-9dad-11d1-80b4-00c04fd430c8",
        symbol="MSFT",
        quantity=Decimal("2"),
    )
    assert pid == "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    table.select.assert_called_once_with("id")
