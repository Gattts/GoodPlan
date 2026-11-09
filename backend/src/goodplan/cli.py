"""Linha de comando: `goodplan migrate | serve | jobs run-due | jobs run <rotina> | openapi`."""

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

import uvicorn
from alembic import command
from alembic.config import Config
from sqlalchemy.orm import sessionmaker

from goodplan.app import create_app
from goodplan.config import Settings, get_settings, normalize_database_url
from goodplan.db import create_db_engine
from goodplan.http import default_http_factory
from goodplan.jobs.runner import Clock, JobResult, run_due, run_job, utc_now


def run_migrations(settings: Settings) -> None:
    config = Config()
    config.set_main_option("script_location", "goodplan:migrations")
    # O ConfigParser do Alembic interpreta "%"; uma senha de banco na URL poderia conter um.
    config.set_main_option("sqlalchemy.url", normalize_database_url(settings.database_url).replace("%", "%%"))
    command.upgrade(config, "head")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="goodplan", description="API do GoodPlan")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("migrate", help="aplica as migrações do banco")
    serve = commands.add_parser("serve", help="aplica as migrações e sobe a API")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    jobs = commands.add_parser("jobs", help="roda as rotinas (câmbio e aeroportos)")
    jobs_commands = jobs.add_subparsers(dest="jobs_command", required=True)
    jobs_commands.add_parser("run-due", help="roda o câmbio e, se estiver na hora, os aeroportos")
    run = jobs_commands.add_parser("run", help="roda uma rotina agora")
    run.add_argument("job", choices=["rates", "airports"])
    run.add_argument("--file", type=Path, help="lê de um arquivo local em vez da internet")
    commands.add_parser("openapi", help="imprime o esquema OpenAPI (tipos do front)")
    return parser


def main(
    argv: Sequence[str] | None = None,
    *,
    settings: Settings | None = None,
    clock: Clock | None = None,
) -> int:
    args = _parser().parse_args(argv)
    settings = settings or get_settings()
    if args.command == "openapi":
        print(json.dumps(create_app(settings).openapi(), ensure_ascii=False))
        return 0
    run_migrations(settings)
    if args.command == "migrate":
        print("Migrações aplicadas.")
        return 0
    if args.command == "serve":
        uvicorn.run(create_app(settings), host=args.host, port=args.port)
        return 0
    return _run_jobs(args, settings, clock or utc_now)


def _run_jobs(args: argparse.Namespace, settings: Settings, clock: Clock) -> int:
    engine = create_db_engine(settings.database_url)
    sessions = sessionmaker(engine, expire_on_commit=False)
    try:
        if args.jobs_command == "run-due":
            results = run_due(sessions, default_http_factory, settings, clock())
        else:
            results = [
                run_job(args.job, sessions, default_http_factory, settings, clock(), source_file=args.file)
            ]
    finally:
        engine.dispose()
    for result in results:
        print(_line(result))
    return 1 if any(result.status == "error" for result in results) else 0


def _line(result: JobResult) -> str:
    return f"{result.job}: {result.status} — {result.detail}"
