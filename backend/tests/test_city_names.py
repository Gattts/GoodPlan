import pytest

from goodplan.airports.importer import load_city_names
from goodplan.paths import CITY_NAMES_FILE


def test_city_names_file_is_well_formed():
    names = load_city_names(CITY_NAMES_FILE)
    assert len(names) == 72
    assert all(len(code) == 3 and code.isupper() and city.strip() for code, city in names.items())
    assert names["HND"] == names["NRT"] == "Tóquio"


def test_duplicate_code_is_refused(tmp_path):
    path = tmp_path / "c.csv"
    path.write_text("iata,cidade\nHND,Tóquio\nHND,Tokyo\n", encoding="utf-8")
    with pytest.raises(ValueError, match=r"código repetido em cidades_pt\.csv: HND"):
        load_city_names(path)
