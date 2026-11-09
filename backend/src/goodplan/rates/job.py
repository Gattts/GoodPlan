"""Rotina de câmbio: busca as cotações do Frankfurter com o real como base e grava em exchange_rates."""

import json
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import httpx2
from sqlalchemy import select
from sqlalchemy.orm import Session

from goodplan.http import get_with_retries
from goodplan.locale_data import official_currencies
from goodplan.models import ExchangeRate

BASE = "BRL"
SOURCE = "frankfurter"
TIMEOUT_SECONDS = 20.0
# Variação diária acima disso entra no detalhe da rotina: pode ser crise real ou erro da fonte.
VARIATION_ALERT = Decimal("0.20")
# Fora disso o valor não cabe em Numeric(24, 12): o grande derruba o lote inteiro e o pequeno vira zero.
MIN_RATE = Decimal("1e-9")
MAX_RATE = Decimal("1e11")
_CURRENCY = re.compile(r"[A-Z]{3}")


@dataclass(frozen=True)
class RateRow:
    currency: str
    rate_date: date
    units_per_brl: Decimal


@dataclass(frozen=True)
class ParsedRates:
    rows: list[RateRow]
    discarded: int


class InvalidPayload(Exception):
    """A resposta da fonte não tem o formato esperado: nada é gravado."""


def parse_rates(payload: object, today: date, official: frozenset[str]) -> ParsedRates:
    """Descarta e conta o item ruim; só é erro a estrutura errada ou não sobrar nenhuma cotação."""
    if not isinstance(payload, list):
        raise InvalidPayload("a resposta não é uma lista de cotações")
    rows: dict[tuple[str, date], RateRow] = {}
    discarded = 0
    latest_allowed = today + timedelta(days=1)
    for item in payload:
        read = _read_item(item)
        if read is None or read[0] not in official or read[0] == BASE or read[1] > latest_allowed:
            discarded += 1
            continue
        currency, rate_date, value = read
        rows[(currency, rate_date)] = RateRow(currency, rate_date, value)  # repetida: vale a última
    if not rows:
        raise InvalidPayload(f"nenhuma cotação aproveitável ({discarded} descartadas)")
    return ParsedRates(list(rows.values()), discarded)


def _read_item(item: object) -> tuple[str, date, Decimal] | None:
    """Moeda, data e valor do item; None se ele estiver malformado."""
    if not isinstance(item, dict) or item.get("base") != BASE:
        return None
    quote, rate = item.get("quote"), item.get("rate")
    if not isinstance(quote, str) or not _CURRENCY.fullmatch(quote):
        return None
    if isinstance(rate, bool) or not isinstance(rate, int | float):
        return None
    value = Decimal(str(rate))
    if not value.is_finite() or not MIN_RATE <= value < MAX_RATE:
        return None
    try:
        rate_date = date.fromisoformat(item.get("date"))  # type: ignore[arg-type]  # o TypeError é tratado abaixo
    except (TypeError, ValueError):
        return None
    return quote, rate_date, value


def store_rates(session: Session, rows: list[RateRow], fetched_at: datetime) -> list[str]:
    """Insere ou atualiza cada cotação e devolve as variações acima de 20% (ex.: "UYU +27%")."""
    notes: list[str] = []
    for row in rows:
        previous = session.scalar(
            select(ExchangeRate.units_per_brl)
            .where(ExchangeRate.currency == row.currency, ExchangeRate.rate_date < row.rate_date)
            .order_by(ExchangeRate.rate_date.desc())
            .limit(1)
        )
        if previous:
            change = (row.units_per_brl - previous) / previous
            if abs(change) > VARIATION_ALERT:
                notes.append(f"{row.currency} {round(change * 100):+d}%")
        current = session.get(ExchangeRate, (row.currency, row.rate_date))
        if current is None:
            session.add(
                ExchangeRate(
                    currency=row.currency,
                    rate_date=row.rate_date,
                    units_per_brl=row.units_per_brl,
                    source=SOURCE,
                    fetched_at=fetched_at,
                )
            )
        else:
            current.units_per_brl = row.units_per_brl
            current.source = SOURCE
            current.fetched_at = fetched_at
    session.commit()
    return notes


def run_rates(
    session: Session,
    client: httpx2.Client | None,
    base_url: str,
    now: datetime,
    *,
    source_file: Path | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> str:
    """Busca (ou lê de `source_file`), confere, grava e devolve o resumo para o job_runs."""
    payload = _load_payload(client, base_url, source_file, sleep)
    today = now.date()
    parsed = parse_rates(payload, today, official_currencies(today))
    notes = store_rates(session, parsed.rows, now)
    latest = max((row.rate_date for row in parsed.rows), default=None)
    detail = (
        f"moedas gravadas: {len(parsed.rows)}, descartadas: {parsed.discarded}, "
        f"data mais recente: {latest.strftime('%d/%m/%Y') if latest else '—'}"
    )
    return f"{detail}; variação acima de 20%: {', '.join(notes)}" if notes else detail


def _load_payload(
    client: httpx2.Client | None, base_url: str, source_file: Path | None, sleep: Callable[[float], None]
) -> object:
    if source_file is not None:
        text = source_file.read_text(encoding="utf-8")
    elif client is not None:
        url = f"{base_url.rstrip('/')}/v2/rates"
        text = get_with_retries(client, url, params={"base": BASE}, timeout=TIMEOUT_SECONDS, sleep=sleep).text
    else:
        raise ValueError("sem cliente HTTP e sem arquivo de cotações")
    try:
        payload: object = json.loads(text)
    except json.JSONDecodeError as error:
        raise InvalidPayload("a resposta não é JSON") from error
    return payload
