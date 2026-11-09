"""Rota da última cotação."""

from fastapi import APIRouter, Response

from goodplan.db import DbSession
from goodplan.rates.service import latest_rates
from goodplan.schemas import RatesOut

router = APIRouter()


@router.get("/rates/latest")
def get_latest_rates(session: DbSession, response: Response) -> RatesOut:
    # O Worker serve a cópia do KV; este cache vale para quem chega à API antes de o KV ter dados.
    response.headers["Cache-Control"] = "public, max-age=3600"
    return latest_rates(session)
