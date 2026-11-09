from datetime import UTC, datetime
from pathlib import Path

import pytest

from goodplan.airports.importer import import_airports, load_city_names, parse_airports_csv
from goodplan.paths import CITY_NAMES_FILE

SAMPLE = (Path(__file__).parent / "fixtures" / "airports_sample.csv").read_text(encoding="utf-8")
NOW = datetime(2026, 11, 5, 20, 0, tzinfo=UTC)


@pytest.fixture
def imported(db):
    import_airports(db, parse_airports_csv(SAMPLE), load_city_names(CITY_NAMES_FILE), NOW)


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("toquio", ["HND", "NRT"]),
        ("Tóquio", ["HND", "NRT"]),
        ("lisboa", ["LIS"]),
        ("GRU", ["GRU"]),
        ("gru", ["GRU"]),
        ("sao paulo", ["GRU", "CGH"]),
        ("japao", ["HND", "NRT"]),
        ("montevideu", ["MVD"]),
    ],
)
def test_search(client, imported, q, expected):
    assert [a["iata"] for a in client.get("/api/airports/search", params={"q": q}).json()] == expected


def test_exact_code_comes_before_city_matches(client, imported):
    # "lim" é o código de Lima e o começo de nada mais; "mu" começa "Munich" e "Munique" (MUC).
    assert [a["iata"] for a in client.get("/api/airports/search", params={"q": "lim"}).json()] == ["LIM"]
    assert client.get("/api/airports/search", params={"q": "mu"}).json()[0]["iata"] == "MUC"


def test_search_response_shape_and_cache(client, imported):
    response = client.get("/api/airports/search", params={"q": "lisboa"})
    assert response.headers["cache-control"] == "public, max-age=86400"
    assert response.json() == [
        {
            "iata": "LIS",
            "name": "Lisbon Humberto Delgado Airport",
            "city": "Lisboa",
            "country_code": "PT",
            "country_name": "Portugal",
            "currency": "EUR",
            "kind": "large_airport",
        }
    ]


def test_limit_cuts_the_list(client, imported):
    assert len(client.get("/api/airports/search", params={"q": "airport", "limit": 2}).json()) == 2


def test_query_that_normalizes_to_nothing_returns_empty(client, imported):  # foco da revisão 3
    response = client.get("/api/airports/search", params={"q": "%%"})
    assert (response.status_code, response.json()) == (200, [])


@pytest.mark.parametrize(
    ("params", "message"),
    [
        ({"q": " a "}, "A busca precisa ter de 2 a 64 caracteres."),
        ({"q": "x" * 65}, "A busca precisa ter de 2 a 64 caracteres."),
        ({}, "A busca precisa ter de 2 a 64 caracteres."),
        ({"q": "lisboa", "limit": 0}, "O limite vai de 1 a 20."),
        ({"q": "lisboa", "limit": 21}, "O limite vai de 1 a 20."),
        ({"q": "lisboa", "limit": "muitos"}, "Parâmetros inválidos."),
    ],
)
def test_invalid_search_returns_422_in_portuguese(client, params, message):
    response = client.get("/api/airports/search", params=params)
    assert (response.status_code, response.json()) == (422, {"detail": message})


def test_get_one_airport(client, imported):
    response = client.get("/api/airports/lis")
    assert response.json()["iata"] == "LIS"
    assert response.headers["cache-control"] == "public, max-age=86400"
    missing = client.get("/api/airports/XXX")
    assert (missing.status_code, missing.json()) == (404, {"detail": "Aeroporto não encontrado."})
    invalid = client.get("/api/airports/LISB")
    assert (invalid.status_code, invalid.json()) == (422, {"detail": "O código precisa ter 3 letras."})
