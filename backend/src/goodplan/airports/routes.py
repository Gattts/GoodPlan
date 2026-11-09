"""Rotas de aeroportos: busca e consulta por código."""

import re

from fastapi import APIRouter, Response

from goodplan.airports.search import search_airports
from goodplan.db import DbSession
from goodplan.errors import AppError
from goodplan.locale_data import country_name_pt
from goodplan.models import Airport
from goodplan.schemas import AirportOut

router = APIRouter()

CACHE_CONTROL = "public, max-age=86400"
MIN_QUERY, MAX_QUERY = 2, 64
MIN_LIMIT, MAX_LIMIT, DEFAULT_LIMIT = 1, 20, 8
_IATA = re.compile(r"[A-Z]{3}")


def airport_out(airport: Airport) -> AirportOut:
    return AirportOut(
        iata=airport.iata,
        name=airport.name,
        city=airport.city_pt or airport.city,
        country_code=airport.country_code,
        country_name=country_name_pt(airport.country_code),
        currency=airport.currency,
        kind=airport.kind,
    )


@router.get("/airports/search")
def search(
    session: DbSession, response: Response, q: str = "", limit: int = DEFAULT_LIMIT
) -> list[AirportOut]:
    query = q.strip()
    if not MIN_QUERY <= len(query) <= MAX_QUERY:
        raise AppError(f"A busca precisa ter de {MIN_QUERY} a {MAX_QUERY} caracteres.", 422)
    if not MIN_LIMIT <= limit <= MAX_LIMIT:
        raise AppError(f"O limite vai de {MIN_LIMIT} a {MAX_LIMIT}.", 422)
    response.headers["Cache-Control"] = CACHE_CONTROL
    return [airport_out(airport) for airport in search_airports(session, query, limit)]


@router.get("/airports/{iata}")
def get_airport(iata: str, session: DbSession, response: Response) -> AirportOut:
    code = iata.strip().upper()
    if not _IATA.fullmatch(code):
        raise AppError("O código precisa ter 3 letras.", 422)
    airport = session.get(Airport, code)
    if airport is None:
        raise AppError("Aeroporto não encontrado.", 404)
    response.headers["Cache-Control"] = CACHE_CONTROL
    return airport_out(airport)
