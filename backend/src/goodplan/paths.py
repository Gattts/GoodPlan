"""Arquivos de dados que vão junto com o pacote."""

from pathlib import Path

# Nome em português das cidades cujo nome no OurAirports está em inglês (Tóquio, Munique, Nova York...).
CITY_NAMES_FILE = Path(__file__).parent / "data" / "cidades_pt.csv"
