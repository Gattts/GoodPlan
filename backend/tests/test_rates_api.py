from datetime import UTC, date, datetime
from decimal import Decimal

from goodplan.rates.job import RateRow, store_rates
from goodplan.rates.service import brl_per_unit

NOW = datetime(2026, 11, 5, 20, 0, 7, tzinfo=UTC)


def test_latest_rates_when_empty(client):
    assert client.get("/api/rates/latest").json() == {
        "base": "BRL",
        "source": {"name": "Frankfurter", "url": "https://frankfurter.dev"},
        "latest_date": None,
        "fetched_at": None,
        "rates": [],
    }


def test_latest_rate_per_currency_in_reais(client, db):
    store_rates(db, [RateRow("EUR", date(2026, 11, 4), Decimal("0.165"))], NOW)
    store_rates(
        db,
        [
            RateRow("EUR", date(2026, 11, 5), Decimal("0.1627")),
            RateRow("UYU", date(2026, 11, 5), Decimal("7.3597")),
        ],
        NOW,
    )
    response = client.get("/api/rates/latest")
    assert response.headers["cache-control"] == "public, max-age=3600"
    body = response.json()
    assert body["latest_date"] == "2026-11-05"
    assert body["fetched_at"] == "2026-11-05T20:00:07Z"
    assert body["rates"] == [
        {"currency": "EUR", "name": "Euro", "brl_per_unit": 6.14628, "date": "2026-11-05"},
        {"currency": "UYU", "name": "Peso uruguaio", "brl_per_unit": 0.135875, "date": "2026-11-05"},
    ]


def test_brl_per_unit_keeps_six_significant_digits():
    assert [brl_per_unit(Decimal(v)) for v in ("0.1627", "7.3597", "7000")] == [
        6.14628,
        0.135875,
        0.000142857,
    ]
