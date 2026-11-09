from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from goodplan.airports.importer import file_fingerprint
from goodplan.jobs.runner import JobResult, airports_due, run_due
from goodplan.models import JobRun
from goodplan.paths import CITY_NAMES_FILE

NOW = datetime(2026, 11, 5, 20, 0, tzinfo=UTC)


def no_wait(_seconds: float) -> None:
    return None


def add_run(db, job: str, status: str, started: datetime, fingerprint: str | None = None) -> None:
    db.add(
        JobRun(
            job=job,
            status=status,
            started_at=started,
            finished_at=started,
            detail="",
            fingerprint=fingerprint,
        )
    )
    db.commit()


def test_airports_due_rules(db):
    assert airports_due(db, NOW, "abc")  # nunca importou
    add_run(db, "airports", "error", NOW - timedelta(days=1), "abc")
    assert airports_due(db, NOW, "abc")  # só falhou
    add_run(db, "airports", "ok", NOW - timedelta(days=10), "abc")
    assert not airports_due(db, NOW, "abc")
    assert airports_due(db, NOW, "xyz")  # o arquivo de nomes mudou
    assert airports_due(db, NOW + timedelta(days=21), "abc")  # 31 dias depois


def test_run_due_records_each_job(app, db, mock_http):
    results = run_due(app.state.sessionmaker, mock_http, app.state.settings, NOW, sleep=no_wait)
    assert [(r.job, r.status) for r in results] == [("rates", "ok"), ("airports", "ok")]
    runs = db.scalars(select(JobRun).order_by(JobRun.id)).all()
    assert [(r.job, r.status) for r in runs] == [("rates", "ok"), ("airports", "ok")]
    assert all(r.finished_at for r in runs)
    assert runs[0].detail == "moedas gravadas: 4, descartadas: 3, data mais recente: 05/11/2026"
    assert runs[1].fingerprint == file_fingerprint(CITY_NAMES_FILE)


def test_second_run_skips_airports(app, db, mock_http):
    run_due(app.state.sessionmaker, mock_http, app.state.settings, NOW, sleep=no_wait)
    again = run_due(app.state.sessionmaker, mock_http, app.state.settings, NOW, sleep=no_wait)
    assert again[1] == JobResult("airports", "skipped", "última importação em 05/11/2026")
    assert db.scalar(select(func.count()).select_from(JobRun)) == 3


def test_a_failing_job_does_not_stop_the_others(app, db, failing_rates_http):
    results = run_due(app.state.sessionmaker, failing_rates_http, app.state.settings, NOW, sleep=no_wait)
    assert results[0].status == "error"
    assert "503" in results[0].detail
    assert results[1].status == "ok"
    failed = db.scalar(select(JobRun).where(JobRun.job == "rates"))
    assert (failed.status, failed.finished_at is not None) == ("error", True)
