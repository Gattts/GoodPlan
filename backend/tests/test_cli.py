import json
from datetime import UTC, datetime

from sqlalchemy import inspect

from goodplan.cli import main
from goodplan.config import Settings
from goodplan.db import create_db_engine
from tests.conftest import FIXTURES

NOW = datetime(2026, 11, 5, 20, 0, tzinfo=UTC)


def _settings(tmp_path) -> Settings:
    return Settings(_env_file=None, database_url=f"sqlite:///{tmp_path}/j.db")


def test_jobs_run_rates_from_file(tmp_path, capsys):
    code = main(
        ["jobs", "run", "rates", "--file", str(FIXTURES / "frankfurter_brl.json")],
        settings=_settings(tmp_path),
        clock=lambda: NOW,
    )
    assert code == 0
    assert capsys.readouterr().out.strip() == (
        "rates: ok — moedas gravadas: 4, descartadas: 3, data mais recente: 05/11/2026"
    )


def test_jobs_run_airports_from_file(tmp_path, capsys):
    code = main(
        ["jobs", "run", "airports", "--file", str(FIXTURES / "airports_sample.csv")],
        settings=_settings(tmp_path),
        clock=lambda: NOW,
    )
    assert code == 0
    assert capsys.readouterr().out.strip() == "airports: ok — 9 aeroportos (novos: 9, removidos: 0)"


def test_failed_job_exits_with_1(tmp_path, capsys):
    broken = tmp_path / "quebrado.json"
    broken.write_text("{não é json", encoding="utf-8")
    code = main(
        ["jobs", "run", "rates", "--file", str(broken)], settings=_settings(tmp_path), clock=lambda: NOW
    )
    assert code == 1
    assert capsys.readouterr().out.startswith("rates: error — ")


def test_openapi_prints_the_schema(tmp_path, capsys):
    assert main(["openapi"], settings=_settings(tmp_path)) == 0
    paths = json.loads(capsys.readouterr().out)["paths"]
    assert {"/api/rates/latest", "/api/airports/search", "/api/internal/jobs/run-due"} <= paths.keys()


def test_serve_applies_migrations_before_starting(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path}/s.db"
    started = {}
    monkeypatch.setattr("uvicorn.run", lambda app, host, port, **kw: started.update(host=host, port=port))

    exit_code = main(
        ["serve", "--host", "0.0.0.0", "--port", "9000"], settings=Settings(_env_file=None, database_url=url)
    )

    assert exit_code == 0
    assert started == {"host": "0.0.0.0", "port": 9000}
    engine = create_db_engine(url)
    assert {"exchange_rates", "airports", "job_runs"} <= set(inspect(engine).get_table_names())
    engine.dispose()


def test_migrate_creates_the_tables(tmp_path, capsys):
    url = f"sqlite:///{tmp_path}/m.db"
    assert main(["migrate"], settings=Settings(_env_file=None, database_url=url)) == 0
    assert "Migrações aplicadas." in capsys.readouterr().out
    engine = create_db_engine(url)
    assert "job_runs" in inspect(engine).get_table_names()
    engine.dispose()
