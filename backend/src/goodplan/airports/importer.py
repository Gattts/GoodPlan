"""Importação dos aeroportos do OurAirports (domínio público), com nomes de cidade em português."""

import csv
import hashlib
import io
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import httpx2
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from goodplan.http import get_with_retries
from goodplan.locale_data import country_name_pt, main_currency
from goodplan.models import Airport
from goodplan.text import normalize

REQUIRED_COLUMNS = (
    "iata_code",
    "name",
    "municipality",
    "iso_country",
    "type",
    "scheduled_service",
    "latitude_deg",
    "longitude_deg",
    "keywords",
)
# Ordem de porte: com o mesmo código IATA repetido, vale o de maior porte.
KIND_ORDER = {"large_airport": 0, "medium_airport": 1, "small_airport": 2}
# Um arquivo com menos que isso do total atual provavelmente veio cortado: a importação é cancelada.
MIN_SHARE_OF_CURRENT = 0.8
TIMEOUT_SECONDS = 60.0
_IATA = re.compile(r"[A-Z]{3}")


@dataclass(frozen=True)
class AirportRow:
    iata: str
    name: str
    city: str
    country_code: str
    kind: str
    latitude: float
    longitude: float
    keywords: str


class InvalidAirportsFile(Exception):
    """O arquivo não tem o formato esperado: a tabela atual continua valendo."""


class TooFewAirports(Exception):
    """O arquivo traz bem menos aeroportos que a tabela atual: a tabela atual continua valendo."""


def parse_airports_csv(text: str) -> list[AirportRow]:
    """Fica com quem tem código IATA, voo regular e porte grande, médio ou pequeno."""
    reader = csv.DictReader(io.StringIO(text))
    columns = reader.fieldnames or []
    for column in REQUIRED_COLUMNS:
        if column not in columns:
            raise InvalidAirportsFile(f"coluna ausente: {column}")
    best: dict[str, AirportRow] = {}
    for record in reader:
        row = _read_record(record)
        if row is None:
            continue
        current = best.get(row.iata)
        if current is None or KIND_ORDER[row.kind] < KIND_ORDER[current.kind]:
            best[row.iata] = row
    return list(best.values())


def _read_record(record: dict[str, str]) -> AirportRow | None:
    iata = (record["iata_code"] or "").strip()
    kind = record["type"]
    if not _IATA.fullmatch(iata) or record["scheduled_service"] != "yes" or kind not in KIND_ORDER:
        return None
    try:
        latitude, longitude = float(record["latitude_deg"]), float(record["longitude_deg"])
    except (TypeError, ValueError):
        return None
    name = (record["name"] or "").strip()
    return AirportRow(
        iata=iata,
        name=name,
        city=(record["municipality"] or "").strip() or name,
        country_code=(record["iso_country"] or "").strip(),
        kind=kind,
        latitude=latitude,
        longitude=longitude,
        keywords=record["keywords"] or "",
    )


def load_city_names(path: Path) -> dict[str, str]:
    names: dict[str, str] = {}
    with path.open(encoding="utf-8", newline="") as file:
        for record in csv.DictReader(file):
            code, city = record["iata"].strip(), record["cidade"].strip()
            if code in names:
                raise ValueError(f"código repetido em cidades_pt.csv: {code}")
            names[code] = city
    return names


def file_fingerprint(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def import_airports(
    session: Session, rows: list[AirportRow], city_names: dict[str, str], now: datetime
) -> str:
    """Insere ou atualiza, apaga quem saiu do arquivo e devolve o resumo para o job_runs."""
    existing = {airport.iata: airport for airport in session.scalars(select(Airport))}
    if existing and len(rows) < MIN_SHARE_OF_CURRENT * len(existing):
        raise TooFewAirports(f"arquivo com poucos aeroportos: {len(rows)} de {len(existing)}")
    today = now.date()
    for row in rows:
        city_pt = city_names.get(row.iata)
        country_pt = country_name_pt(row.country_code)
        values = {
            "name": row.name,
            "city": row.city,
            "city_pt": city_pt,
            "country_code": row.country_code,
            "kind": row.kind,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "currency": main_currency(row.country_code, today),
            "search_text": normalize(
                " ".join([row.iata, row.name, row.city, row.keywords, city_pt or "", country_pt or ""])
            ),
            "updated_at": now,
        }
        airport = existing.get(row.iata)
        if airport is None:
            session.add(Airport(iata=row.iata, **values))
        else:
            for field, value in values.items():
                setattr(airport, field, value)
    codes = {row.iata for row in rows}
    removed = existing.keys() - codes
    if removed:
        session.execute(delete(Airport).where(Airport.iata.in_(removed)))
    session.commit()
    added = len(codes - existing.keys())
    return f"{_count(len(rows))} aeroportos (novos: {_count(added)}, removidos: {_count(len(removed))})"


def _count(number: int) -> str:
    return f"{number:,}".replace(",", ".")


def run_airports(
    session: Session,
    client: httpx2.Client | None,
    url: str,
    now: datetime,
    city_names_file: Path,
    *,
    source_file: Path | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> tuple[str, str]:
    """Baixa (ou lê de `source_file`) e importa. Devolve o resumo e o hash do arquivo de nomes."""
    if source_file is not None:
        text = source_file.read_text(encoding="utf-8")
    elif client is not None:
        text = get_with_retries(client, url, timeout=TIMEOUT_SECONDS, sleep=sleep).text
    else:
        raise ValueError("sem cliente HTTP e sem arquivo de aeroportos")
    detail = import_airports(session, parse_airports_csv(text), load_city_names(city_names_file), now)
    return detail, file_fingerprint(city_names_file)
