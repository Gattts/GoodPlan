import hashlib
from datetime import UTC, datetime
from pathlib import Path

import httpx2
import pytest
from sqlalchemy import func, select

from goodplan.airports.importer import (
    InvalidAirportsFile,
    TooFewAirports,
    file_fingerprint,
    import_airports,
    load_city_names,
    parse_airports_csv,
    run_airports,
)
from goodplan.models import Airport
from goodplan.paths import CITY_NAMES_FILE

SAMPLE_FILE = Path(__file__).parent / "fixtures" / "airports_sample.csv"
SAMPLE = SAMPLE_FILE.read_text(encoding="utf-8")
NOW = datetime(2026, 11, 5, 20, 0, tzinfo=UTC)


def test_parse_keeps_scheduled_airports_with_iata_and_prefers_the_bigger_one():
    rows = parse_airports_csv(SAMPLE)
    assert sorted(r.iata for r in rows) == ["CGH", "GRU", "HND", "JFK", "LIM", "LIS", "MUC", "MVD", "NRT"]
    assert next(r for r in rows if r.iata == "LIM").kind == "large_airport"


def test_missing_column_raises():
    with pytest.raises(InvalidAirportsFile, match="coluna ausente: keywords"):
        parse_airports_csv(SAMPLE.replace(',"keywords"', "", 1))


def test_import_enriches_with_portuguese_city_currency_and_search_text(db):
    detail = import_airports(db, parse_airports_csv(SAMPLE), load_city_names(CITY_NAMES_FILE), NOW)
    assert detail == "9 aeroportos (novos: 9, removidos: 0)"
    hnd = db.get(Airport, "HND")
    assert (hnd.city_pt, hnd.currency) == ("Tóquio", "JPY")
    assert {"hnd", "tokyo", "toquio", "japao", "tyo"} <= set(hnd.search_text.split())
    assert db.get(Airport, "MVD").city_pt == "Montevidéu"
    assert db.get(Airport, "GRU").city_pt is None


def test_import_removes_airports_that_left_the_file(db):
    rows = parse_airports_csv(SAMPLE)
    import_airports(db, rows, {}, NOW)
    without_lima = [r for r in rows if r.iata != "LIM"]
    assert import_airports(db, without_lima, {}, NOW) == "8 aeroportos (novos: 0, removidos: 1)"
    assert db.get(Airport, "LIM") is None


def test_import_refuses_a_file_with_less_than_80_percent(db):
    rows = parse_airports_csv(SAMPLE)
    import_airports(db, rows, {}, NOW)
    with pytest.raises(TooFewAirports, match="arquivo com poucos aeroportos: 7 de 9"):
        import_airports(db, rows[:7], {}, NOW)
    assert db.scalar(select(func.count()).select_from(Airport)) == 9


def test_fingerprint_is_the_sha256_of_the_file(tmp_path):
    path = tmp_path / "c.csv"
    path.write_bytes("iata,cidade\nHND,Tóquio\n".encode())
    assert file_fingerprint(path) == hashlib.sha256("iata,cidade\nHND,Tóquio\n".encode()).hexdigest()


def test_run_airports_downloads_the_csv(db):
    seen: list[str] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        seen.append(str(request.url))
        return httpx2.Response(200, text=SAMPLE)

    with httpx2.Client(transport=httpx2.MockTransport(handler)) as client:
        detail, fingerprint = run_airports(db, client, "https://x.test/airports.csv", NOW, CITY_NAMES_FILE)
    assert seen == ["https://x.test/airports.csv"]
    assert detail == "9 aeroportos (novos: 9, removidos: 0)"
    assert fingerprint == file_fingerprint(CITY_NAMES_FILE)


def test_run_airports_from_file_does_not_need_the_network(db):
    detail, _ = run_airports(db, None, "https://x", NOW, CITY_NAMES_FILE, source_file=SAMPLE_FILE)
    assert detail.startswith("9 aeroportos")
