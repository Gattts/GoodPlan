"""Busca de aeroportos por código, cidade, nome, país ou nome da cidade em português."""

from sqlalchemy import and_, case, select
from sqlalchemy.orm import Session

from goodplan.airports.importer import KIND_ORDER
from goodplan.models import Airport
from goodplan.text import normalize

MAX_CANDIDATES = 200


def search_airports(session: Session, query: str, limit: int) -> list[Airport]:
    """Cada palavra precisa aparecer no texto de busca; a ordem é código exato, cidade, código, resto."""
    words = normalize(query).split()
    if not words:
        return []
    code = query.strip().upper()
    # Com muitos candidatos (ex.: "ai" está em quase todo "airport"), o banco já entrega o código exato e
    # os aeroportos maiores primeiro, para o corte de 200 não deixar de fora quem deveria vir no topo.
    candidates = session.scalars(
        select(Airport)
        .where(and_(*(Airport.search_text.contains(word) for word in words)))
        .order_by(
            case((Airport.iata == code, 0), else_=1),
            case(KIND_ORDER, value=Airport.kind, else_=len(KIND_ORDER)),
            Airport.iata,
        )
        .limit(MAX_CANDIDATES)
    ).all()
    wanted = normalize(query)

    def rank(airport: Airport) -> tuple[int, int, str, str]:
        cities = [normalize(city) for city in (airport.city_pt, airport.city) if city]
        if airport.iata == code:
            position = 0
        elif any(city.startswith(wanted) for city in cities):
            position = 1
        elif airport.iata.startswith(code):
            position = 2
        else:
            position = 3
        size = KIND_ORDER.get(airport.kind, len(KIND_ORDER))
        return position, size, normalize(airport.city_pt or airport.city), airport.iata

    return sorted(candidates, key=rank)[:limit]
