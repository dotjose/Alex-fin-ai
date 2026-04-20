"""POST /api/positions contract tests with mocked persistence."""

from __future__ import annotations

import uuid
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import portfolio


@pytest.fixture
def account_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def position_id() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def mock_db(account_id: str, position_id: str):
    class MockPositions:
        def __init__(self) -> None:
            self.store: dict[str, dict] = {}

        def find_by_account_and_symbol(self, aid: str, sym: str):
            for v in self.store.values():
                if v["account_id"] == aid and v["symbol"] == sym:
                    return dict(v)
            return None

        def find_by_account(self, aid: str):
            rows = [dict(v) for v in self.store.values() if v["account_id"] == aid]
            for r in rows:
                r["current_price"] = 150.0
            return rows

        def add_position(self, account_id: str, symbol: str, quantity: Decimal) -> str:
            self.store[position_id] = {
                "id": position_id,
                "account_id": account_id,
                "symbol": symbol,
                "quantity": float(quantity),
                "as_of_date": "2026-04-19",
            }
            return position_id

        def find_by_id(self, pid: str):
            return self.store.get(pid)

        def update(self, pid: str, data: dict) -> int:
            if pid in self.store:
                self.store[pid].update(data)
            return 1

        def delete(self, pid: str) -> int:
            self.store.pop(pid, None)
            return 1

    positions = MockPositions()

    class MockAccounts:
        def __init__(self) -> None:
            self.row = {
                "id": account_id,
                "clerk_user_id": "user_1",
                "cash_balance": Decimal("100000"),
                "account_name": "Test",
            }

        def find_by_id(self, aid: str):
            if aid == account_id:
                return dict(self.row)
            return None

        def update(self, aid: str, data: dict) -> int:
            if aid == account_id:
                self.row.update(data)
            return 1

    accounts = MockAccounts()

    class MockInstruments:
        def find_by_symbol(self, sym: str):
            return {"symbol": sym, "name": "Test Co", "current_price": Decimal("150")}

        def create_instrument(self, *_args, **_kwargs) -> None:
            return None

    return SimpleNamespace(
        accounts=accounts,
        instruments=MockInstruments(),
        positions=positions,
        _account_id=account_id,
        _position_id=position_id,
    )


@pytest.fixture
def client(monkeypatch, mock_db):
    async def fake_uid_dep() -> str:
        return "user_1"

    monkeypatch.setattr(
        portfolio,
        "current_user_id_factory",
        lambda _settings: fake_uid_dep,
    )
    monkeypatch.setattr(portfolio, "get_database", lambda: mock_db)
    settings = MagicMock()
    app = FastAPI()
    app.include_router(portfolio.build_router(settings))
    return TestClient(app)


def test_post_positions_returns_200_persists_and_returns_id(client, mock_db, position_id):
    resp = client.post(
        "/api/positions",
        json={
            "account_id": mock_db._account_id,
            "symbol": "AAPL",
            "quantity": "10",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["position"]["id"] == position_id
    assert body["position"]["symbol"] == "AAPL"
    assert body["summary"]["total_value"] == body["summary"]["cash_balance"] + body["summary"][
        "holdings_value"
    ]
    assert mock_db.positions.store[position_id]["quantity"] == 10.0
    # 10 shares * $150 = $1500 out of cash
    assert float(mock_db.accounts.row["cash_balance"]) == 100000.0 - 1500.0
