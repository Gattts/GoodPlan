"""Normalização de texto para a busca: "São Paulo" e "sao paulo" viram a mesma coisa."""

import re
import unicodedata

_NOT_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize(text: str) -> str:
    """Sem acentos, minúsculas, só letras e números separados por um espaço (símbolos viram espaço)."""
    decomposed = unicodedata.normalize("NFKD", text)
    without_marks = "".join(char for char in decomposed if not unicodedata.combining(char))
    return _NOT_ALNUM.sub(" ", without_marks.casefold()).strip()
