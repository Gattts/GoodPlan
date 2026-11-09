import json
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import httpx2
import pytest
from sqlalchemy import func, select

from goodplan.locale_data import official_currencies
from goodplan.models import ExchangeRate
from goodplan.rates.job import InvalidPayload, RateRow, parse_rates, run_rates, store_rates

FIXTURE = Path(__file__).parent / "fixtures" / "frankfurter_brl.json"
TODAY = date(2026, 11, 5)
NOW = datetime(2026, 11, 5, 20, 0, tzinfo=UTC)
OFFICIAL = official_currencies(TODAY)


def load_fixture() -> object:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_parse_keeps_official_currencies_and_counts_discards():
    parsed = parse_rates(load_fixture(), TODAY, OFFICIAL)
    assert [r.currency for r in parsed.rows] == ["EUR", "USD", "UYU", "JPY"]
    assert parsed.rows[0] == RateRow("EUR", date(2026, 11, 5), Decimal("0.1627"))
    # ADA (criptomoeda), GBP (valor negativo) e CHF (data no futuro)
    assert parsed.discarded == 3


@pytest.mark.parametrize(
    "payload",
    [
        {"rates": []},
        [{"date": "2026-11-05", "quote": "EUR"}],
        [{"date": "ontem", "base": "BRL", "quote": "EUR", "rate": 1}],
        [{"date": "2026-11-05", "base": "USD", "quote": "EUR", "rate": 1}],
        [{"date": "2026-11-05", "base": "BRL", "quote": "EUR", "rate": "1"}],
        ["EUR"],
        [],
    ],
)
def test_wrong_format_or_no_valid_item_raises(payload):
    with pytest.raises(InvalidPayload):
        parse_rates(payload, TODAY, OFFICIAL)


def test_malformed_items_are_discarded_and_the_rest_is_kept():
    good = {"date": "2026-11-05", "base": "BRL", "quote": "EUR", "rate": 0.1627}
    payload = [
        good,
        {"date": "ontem", "base": "BRL", "quote": "USD", "rate": 1},
        {"quote": "JPY"},
        "texto",
        {"date": "2026-11-05", "base": "BRL", "quote": "UYU", "rate": "1"},
    ]
    parsed = parse_rates(payload, TODAY, OFFICIAL)
    assert [r.currency for r in parsed.rows] == ["EUR"]
    assert parsed.discarded == 4


@pytest.mark.parametrize(
    "rate",
    [
        float("nan"),
        float("inf"),
        float("-inf"),
        pytest.param(10**400, id="10**400"),
        1e13,
        1e11,
        1e-13,
        9e-10,
    ],
)
def test_non_finite_or_absurd_rate_is_discarded(rate):
    payload = [
        {"date": "2026-11-05", "base": "BRL", "quote": "EUR", "rate": 0.1627},
        {"date": "2026-11-05", "base": "BRL", "quote": "USD", "rate": rate},
    ]
    parsed = parse_rates(payload, TODAY, OFFICIAL)
    assert [r.currency for r in parsed.rows] == ["EUR"]
    assert parsed.discarded == 1


@pytest.mark.parametrize("rate", [1e-9, 99_999_999_999])
def test_rate_at_the_limits_is_kept(rate):
    payload = [{"date": "2026-11-05", "base": "BRL", "quote": "USD", "rate": rate}]
    parsed = parse_rates(payload, TODAY, OFFICIAL)
    assert [r.currency for r in parsed.rows] == ["USD"]


def test_same_currency_and_date_twice_keeps_the_last():
    payload = [
        {"date": "2026-11-05", "base": "BRL", "quote": "EUR", "rate": 0.16},
        {"date": "2026-11-05", "base": "BRL", "quote": "EUR", "rate": 0.1627},
    ]
    assert parse_rates(payload, TODAY, OFFICIAL).rows == [
        RateRow("EUR", date(2026, 11, 5), Decimal("0.1627"))
    ]


def test_store_inserts_then_updates_the_same_day(db):
    store_rates(db, [RateRow("EUR", TODAY, Decimal("0.16"))], NOW)
    later = NOW + timedelta(hours=8)
    store_rates(db, [RateRow("EUR", TODAY, Decimal("0.1627"))], later)
    rows = db.scalars(select(ExchangeRate)).all()
    assert [(r.currency, r.units_per_brl) for r in rows] == [("EUR", Decimal("0.1627"))]
    stored = rows[0].fetched_at  # o SQLite devolve sem fuso; o Postgres, com fuso
    assert (stored if stored.tzinfo else stored.replace(tzinfo=UTC)) == later


def test_store_reports_variation_above_20_percent(db):
    yesterday = date(2026, 11, 4)
    store_rates(
        db, [RateRow("UYU", yesterday, Decimal("5.8")), RateRow("EUR", yesterday, Decimal("0.16"))], NOW
    )
    notes = store_rates(
        db, [RateRow("UYU", TODAY, Decimal("7.3597")), RateRow("EUR", TODAY, Decimal("0.1627"))], NOW
    )
    assert notes == ["UYU +27%"]


def test_run_rates_reads_frankfurter_and_writes_the_detail(db):
    seen: list[str] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        seen.append(str(request.url))
        return httpx2.Response(200, json=load_fixture())

    with httpx2.Client(transport=httpx2.MockTransport(handler)) as client:
        detail = run_rates(db, client, "https://api.frankfurter.dev", NOW)
    assert seen == ["https://api.frankfurter.dev/v2/rates?base=BRL"]
    assert detail == "moedas gravadas: 4, descartadas: 3, data mais recente: 05/11/2026"
    assert db.scalar(select(func.count()).select_from(ExchangeRate)) == 4


def test_run_rates_reports_big_variations_in_the_detail(db):
    store_rates(db, [RateRow("UYU", date(2026, 11, 4), Decimal("5.8"))], NOW)
    detail = run_rates(db, None, "https://x", NOW, source_file=FIXTURE)
    assert detail.endswith("; variação acima de 20%: UYU +27%")


def test_run_rates_from_file_does_not_need_the_network(db):
    assert run_rates(db, None, "https://x", NOW, source_file=FIXTURE).startswith("moedas gravadas: 4")


def test_wrong_format_writes_nothing(db):
    transport = httpx2.MockTransport(lambda request: httpx2.Response(200, json={"erro": 1}))
    with httpx2.Client(transport=transport) as client, pytest.raises(InvalidPayload):
        run_rates(db, client, "https://x", NOW)
    assert db.scalar(select(func.count()).select_from(ExchangeRate)) == 0


def test_response_that_is_not_json_is_a_format_error(db):
    transport = httpx2.MockTransport(lambda request: httpx2.Response(200, text="<html>manutenção</html>"))
    with httpx2.Client(transport=transport) as client, pytest.raises(InvalidPayload):
        run_rates(db, client, "https://x", NOW)
