from datetime import date

from goodplan.locale_data import country_name_pt, currency_name_pt, main_currency, official_currencies

D = date(2026, 11, 5)


def test_country_names_in_portuguese():
    assert country_name_pt("JP") == "Japão"
    assert country_name_pt("NZ") == "Nova Zelândia"
    # "ZZ" existe no CLDR ("Região desconhecida"); "QQ" não existe.
    assert country_name_pt("QQ") is None


def test_main_currency_is_the_first_legal_tender():
    assert [main_currency(c, D) for c in ("PT", "UY", "BR", "ZW")] == ["EUR", "UYU", "BRL", "USD"]
    assert main_currency("ZZ", D) is None


def test_official_currencies_exclude_crypto_and_metals():
    official = official_currencies(D)
    assert {"EUR", "UYU", "BRL", "JPY"} <= official
    assert not {"ADA", "BTC", "XAU"} & official


def test_currency_names_in_portuguese():
    assert [currency_name_pt(c) for c in ("EUR", "USD", "UYU")] == [
        "Euro",
        "Dólar americano",
        "Peso uruguaio",
    ]
