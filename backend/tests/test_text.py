from goodplan.text import normalize


def test_normalize_removes_accents_case_and_symbols():
    assert normalize("  São Paulo/Guarulhos–Governor ") == "sao paulo guarulhos governor"
    assert normalize("Tóquio") == "toquio"
    assert normalize("Köln (Cologne)") == "koln cologne"


def test_symbols_only_become_empty():
    assert normalize("%%") == ""
    assert normalize("  -- ") == ""
