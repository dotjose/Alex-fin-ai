"""HTTP route modules."""

from fastapi import FastAPI

from core.config import Settings
from routes import analysis, accounts, debug, portfolio, user


def register_routes(app: FastAPI, settings: Settings) -> None:
    app.include_router(user.build_router(settings))
    app.include_router(accounts.build_router(settings))
    app.include_router(portfolio.build_router(settings))
    app.include_router(analysis.build_router(settings))
    app.include_router(debug.build_router(settings))
