"""Conexão com o banco e sessão por requisição."""

from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from goodplan.config import normalize_database_url

IN_MEMORY_URLS = ("sqlite://", "sqlite:///:memory:")


def create_db_engine(url: str) -> Engine:
    url = normalize_database_url(url)
    if not url.startswith("sqlite"):
        return create_engine(
            url,
            # O pooler do Supabase encerra conexões ociosas; testar antes de usar evita erro no 1º acesso.
            pool_pre_ping=True,
            pool_recycle=300,
            # O pooler em modo transação (porta 6543) não suporta prepared statements.
            connect_args={"prepare_threshold": None},
        )
    if url in IN_MEMORY_URLS:
        # Uma conexão só: no SQLite em memória, cada conexão nova seria um banco vazio.
        return create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    database = make_url(url).database
    if database:
        Path(database).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(url, connect_args={"check_same_thread": False})


def get_session(request: Request) -> Iterator[Session]:
    with request.app.state.sessionmaker() as session:
        yield session


DbSession = Annotated[Session, Depends(get_session)]
