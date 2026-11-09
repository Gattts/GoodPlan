from fastapi.testclient import TestClient
from pydantic import SecretStr

from goodplan.app import create_app
from goodplan.config import Settings
from goodplan.models import Base
from goodplan.security import secrets_match

SECRET = "s" * 32


def _client(**overrides) -> TestClient:
    app = create_app(Settings(_env_file=None, database_url="sqlite://", **overrides))
    Base.metadata.create_all(app.state.engine)
    return TestClient(app)


def test_direct_access_is_refused_when_proxy_only():
    client = _client(proxy_only=True, proxy_secret=SECRET)
    refused = client.get("/api/rates/latest")
    assert (refused.status_code, refused.json()) == (403, {"detail": "Acesso direto não permitido."})
    assert client.get("/api/rates/latest", headers={"X-Proxy-Secret": "x" * 32}).status_code == 403
    assert client.get("/api/rates/latest", headers={"X-Proxy-Secret": SECRET}).status_code == 200


def test_health_is_open_even_when_proxy_only():
    assert _client(proxy_only=True, proxy_secret=SECRET).get("/api/health").status_code == 200


def test_without_proxy_only_no_header_is_needed():
    assert _client().get("/api/rates/latest").status_code == 200


def test_unknown_route_answers_in_portuguese():
    response = _client().get("/api/nao-existe")
    assert (response.status_code, response.json()) == (404, {"detail": "Não encontrado."})


def test_secrets_match_compares_safely():
    assert not secrets_match(None, SecretStr(SECRET))
    assert not secrets_match(SECRET, None)
    assert not secrets_match("x" * 32, SecretStr(SECRET))
    assert secrets_match(SECRET, SecretStr(SECRET))
