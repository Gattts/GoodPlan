import os
from collections.abc import Callable, Iterator
from pathlib import Path

import httpx2
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from goodplan.app import create_app
from goodplan.config import Settings
from goodplan.http import HttpFactory
from goodplan.models import Base

# Defina para rodar a suíte num Postgres de verdade (o mesmo do Supabase). Nunca use GP_DATABASE_URL aqui:
# ela pode apontar para o banco de produção.
TEST_DATABASE_URL = os.environ.get("GP_TEST_DATABASE_URL")
FIXTURES = Path(__file__).parent / "fixtures"
RATES_JSON = (FIXTURES / "frankfurter_brl.json").read_text(encoding="utf-8")
AIRPORTS_CSV = (FIXTURES / "airports_sample.csv").read_text(encoding="utf-8")


def fake_sources(rates_status: int = 200) -> HttpFactory:
    """Frankfurter e OurAirports de mentira, nos mesmos endereços da configuração padrão."""

    def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.host == "api.frankfurter.dev":
            if rates_status != 200:
                return httpx2.Response(rates_status)
            return httpx2.Response(200, text=RATES_JSON, headers={"content-type": "application/json"})
        if request.url.host == "davidmegginson.github.io":
            return httpx2.Response(
                200, text=AIRPORTS_CSV, headers={"content-type": "text/csv; charset=utf-8"}
            )
        return httpx2.Response(404)

    factory: Callable[[], httpx2.Client] = lambda: httpx2.Client(transport=httpx2.MockTransport(handler))  # noqa: E731
    return factory


@pytest.fixture
def mock_http() -> HttpFactory:
    return fake_sources()


@pytest.fixture
def failing_rates_http() -> HttpFactory:
    return fake_sources(rates_status=503)


@pytest.fixture
def settings() -> Settings:
    return Settings(_env_file=None, database_url=TEST_DATABASE_URL or "sqlite://")


@pytest.fixture
def app(settings: Settings) -> Iterator[FastAPI]:
    application = create_app(settings)
    engine = application.state.engine
    Base.metadata.drop_all(engine)  # no Postgres o banco persiste entre testes
    Base.metadata.create_all(engine)
    yield application
    engine.dispose()


@pytest.fixture
def db(app: FastAPI) -> Iterator[Session]:
    with app.state.sessionmaker() as session:
        yield session


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client
