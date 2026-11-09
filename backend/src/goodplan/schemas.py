"""Formatos de resposta da API (viram os tipos do front pelo OpenAPI)."""

import datetime as dt
from typing import Literal

from pydantic import BaseModel


class SourceOut(BaseModel):
    name: str
    url: str


class RateOut(BaseModel):
    currency: str
    name: str
    brl_per_unit: float
    date: dt.date


class AirportOut(BaseModel):
    iata: str
    name: str
    city: str
    country_code: str
    country_name: str | None
    currency: str | None
    kind: str


class JobResultOut(BaseModel):
    job: str
    status: Literal["ok", "error", "skipped"]
    detail: str


class RunDueOut(BaseModel):
    jobs: list[JobResultOut]


class RatesOut(BaseModel):
    base: Literal["BRL"]
    source: SourceOut
    latest_date: dt.date | None
    fetched_at: dt.datetime | None
    rates: list[RateOut]
