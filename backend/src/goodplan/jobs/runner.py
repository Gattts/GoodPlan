"""Rotinas: o câmbio roda sempre; os aeroportos, quando estão na hora. Cada execução fica em job_runs."""

import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from goodplan.airports.importer import file_fingerprint, run_airports
from goodplan.config import Settings
from goodplan.http import HttpFactory
from goodplan.models import JobRun
from goodplan.paths import CITY_NAMES_FILE
from goodplan.rates.job import run_rates

JobName = Literal["rates", "airports"]
JobStatus = Literal["ok", "error", "skipped"]
Clock = Callable[[], datetime]
AIRPORTS_MAX_AGE = timedelta(days=30)
MAX_DETAIL = 2000


@dataclass(frozen=True)
class JobResult:
    job: str
    status: JobStatus
    detail: str


def utc_now() -> datetime:
    return datetime.now(UTC)


def airports_due(session: Session, now: datetime, fingerprint: str) -> bool:
    """Na hora: nunca importou com sucesso, a última tem mais de 30 dias ou o arquivo de nomes mudou."""
    last = _last_success(session, "airports")
    if last is None:
        return True
    return now - _as_utc(last.started_at) > AIRPORTS_MAX_AGE or last.fingerprint != fingerprint


def run_job(
    name: JobName,
    sessions: sessionmaker[Session],
    http_factory: HttpFactory,
    settings: Settings,
    now: datetime,
    *,
    source_file: Path | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> JobResult:
    """Roda uma rotina e registra a execução; uma falha vira linha `error`, nunca exceção para quem chamou."""
    with sessions() as session:
        run = JobRun(job=name, started_at=now, status="running", detail="")
        session.add(run)
        session.commit()
        try:
            detail, fingerprint = _execute(
                name,
                session,
                http_factory=http_factory,
                settings=settings,
                now=now,
                source_file=source_file,
                sleep=sleep,
            )
        except Exception as error:  # qualquer falha da fonte ou dos dados fica registrada
            session.rollback()
            run.status, run.detail = "error", f"{type(error).__name__}: {error}"[:MAX_DETAIL]
        else:
            run.status, run.detail, run.fingerprint = "ok", detail[:MAX_DETAIL], fingerprint
        run.finished_at = utc_now()
        session.commit()
        return JobResult(name, "ok" if run.status == "ok" else "error", run.detail)


def run_due(
    sessions: sessionmaker[Session],
    http_factory: HttpFactory,
    settings: Settings,
    now: datetime,
    *,
    sleep: Callable[[float], None] = time.sleep,
) -> list[JobResult]:
    results = [run_job("rates", sessions, http_factory, settings, now, sleep=sleep)]
    with sessions() as session:
        due = airports_due(session, now, file_fingerprint(CITY_NAMES_FILE))
        last = _last_success(session, "airports")
    if due or last is None:
        results.append(run_job("airports", sessions, http_factory, settings, now, sleep=sleep))
    else:
        detail = f"última importação em {_as_utc(last.started_at):%d/%m/%Y}"
        results.append(JobResult("airports", "skipped", detail))
    return results


def _execute(
    name: JobName,
    session: Session,
    *,
    http_factory: HttpFactory,
    settings: Settings,
    now: datetime,
    source_file: Path | None,
    sleep: Callable[[float], None],
) -> tuple[str, str | None]:
    client = None if source_file is not None else http_factory()
    try:
        if name == "rates":
            return run_rates(
                session, client, settings.frankfurter_url, now, source_file=source_file, sleep=sleep
            ), None
        return run_airports(
            session,
            client,
            settings.ourairports_url,
            now,
            CITY_NAMES_FILE,
            source_file=source_file,
            sleep=sleep,
        )
    finally:
        if client is not None:
            client.close()


def _last_success(session: Session, job: JobName) -> JobRun | None:
    return session.scalar(
        select(JobRun)
        .where(JobRun.job == job, JobRun.status == "ok")
        .order_by(JobRun.started_at.desc(), JobRun.id.desc())
        .limit(1)
    )


def _as_utc(moment: datetime) -> datetime:
    # O SQLite devolve sem fuso o que foi gravado em UTC; o Postgres devolve com fuso.
    return moment.replace(tzinfo=UTC) if moment.tzinfo is None else moment.astimezone(UTC)
