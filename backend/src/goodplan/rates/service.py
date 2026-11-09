"""Última cotação de cada moeda, em reais por unidade."""

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from goodplan.locale_data import currency_name_pt
from goodplan.models import ExchangeRate
from goodplan.schemas import RateOut, RatesOut, SourceOut

SOURCE = SourceOut(name="Frankfurter", url="https://frankfurter.dev")


def brl_per_unit(units_per_brl: Decimal) -> float:
    """De "quanto 1 real compra" para "quanto 1 unidade custa em reais", com 6 algarismos significativos."""
    return float(f"{Decimal(1) / units_per_brl:.6g}")


def latest_rates(session: Session) -> RatesOut:
    newest = (
        select(ExchangeRate.currency, func.max(ExchangeRate.rate_date).label("rate_date"))
        .group_by(ExchangeRate.currency)
        .subquery()
    )
    rows = session.scalars(
        select(ExchangeRate)
        .join(
            newest,
            and_(ExchangeRate.currency == newest.c.currency, ExchangeRate.rate_date == newest.c.rate_date),
        )
        .order_by(ExchangeRate.currency)
    ).all()
    return RatesOut(
        base="BRL",
        source=SOURCE,
        latest_date=max((row.rate_date for row in rows), default=None),
        fetched_at=max((_as_utc(row.fetched_at) for row in rows), default=None),
        rates=[
            RateOut(
                currency=row.currency,
                name=currency_name_pt(row.currency),
                brl_per_unit=brl_per_unit(row.units_per_brl),
                date=row.rate_date,
            )
            for row in rows
        ],
    )


def _as_utc(moment: datetime) -> datetime:
    # O SQLite devolve sem fuso o que foi gravado em UTC; o Postgres devolve com fuso.
    return moment.replace(tzinfo=UTC) if moment.tzinfo is None else moment.astimezone(UTC)
