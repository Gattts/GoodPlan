from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from goodplan.app import create_app
from goodplan.config import Settings
from goodplan.models import Base
from tests.conftest import TEST_DATABASE_URL

TOKEN = "t" * 32
NOW = datetime(2026, 11, 5, 20, 0, tzinfo=UTC)


@pytest.fixture
def token_client(mock_http) -> Iterator[TestClient]:
    settings = Settings(_env_file=None, database_url=TEST_DATABASE_URL or "sqlite://", jobs_token=TOKEN)
    app = create_app(settings, http_factory=mock_http, clock=lambda: NOW)
    Base.metadata.drop_all(app.state.engine)
    Base.metadata.create_all(app.state.engine)
    with TestClient(app) as client:
        yield client
    app.state.engine.dispose()


def test_route_hidden_without_configured_token(client):
    response = client.post("/api/internal/jobs/run-due")
    assert (response.status_code, response.json()) == (404, {"detail": "Não encontrado."})


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer errado"}, {"Authorization": TOKEN}])
def test_missing_or_wrong_token_is_401(token_client, headers):
    response = token_client.post("/api/internal/jobs/run-due", headers=headers)
    assert (response.status_code, response.json()) == (401, {"detail": "Não autorizado."})


def test_runs_due_jobs(token_client):
    response = token_client.post("/api/internal/jobs/run-due", headers={"Authorization": f"Bearer {TOKEN}"})
    assert response.status_code == 200
    assert response.json()["jobs"] == [
        {
            "job": "rates",
            "status": "ok",
            "detail": "moedas gravadas: 4, descartadas: 3, data mais recente: 05/11/2026",
        },
        {"job": "airports", "status": "ok", "detail": "9 aeroportos (novos: 9, removidos: 0)"},
    ]
