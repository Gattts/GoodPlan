"""Nomes de país e de moeda em português e a moeda de cada país, pelos dados do Unicode CLDR (Babel)."""

from datetime import date
from functools import lru_cache

from babel import Locale
from babel.numbers import get_currency_name, get_territory_currencies

_PT_BR = Locale.parse("pt_BR")
COUNTRY_CODE_LENGTH = 2  # ISO 3166; o CLDR também lista regiões com 3 dígitos (ex.: "419", América Latina)


def country_name_pt(code: str) -> str | None:
    return _PT_BR.territories.get(code.upper())


def main_currency(country_code: str, on: date) -> str | None:
    """A primeira moeda de curso legal do país na data (ex.: Zimbábue → USD). País desconhecido → None."""
    currencies = get_territory_currencies(country_code.upper(), on, tender=True)
    return currencies[0] if currencies else None


@lru_cache
def official_currencies(on: date) -> frozenset[str]:
    """Moedas oficiais de algum país na data: tira criptomoedas e metais que as fontes de câmbio misturam."""
    territories = (
        code
        for code in Locale("en").territories
        if isinstance(code, str) and len(code) == COUNTRY_CODE_LENGTH and code.isalpha()
    )
    return frozenset(
        currency for code in territories for currency in get_territory_currencies(code, on, tender=True)
    )


def currency_name_pt(code: str) -> str:
    return get_currency_name(code, locale=_PT_BR)
