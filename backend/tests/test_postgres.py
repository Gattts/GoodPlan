"""Migrações e proteções no PostgreSQL (o banco do Supabase). Rodam só com GP_TEST_DATABASE_URL."""

from collections.abc import Iterator

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Engine, text
from sqlalchemy.exc import ProgrammingError

from goodplan.cli import run_migrations
from goodplan.config import Settings
from goodplan.db import create_db_engine
from goodplan.models import Base
from tests.conftest import TEST_DATABASE_URL

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL or "postgres" not in TEST_DATABASE_URL,
    reason="defina GP_TEST_DATABASE_URL com um Postgres para rodar",
)

TABLES = [*Base.metadata.tables, "alembic_version"]


@pytest.fixture
def migrated() -> Iterator[Engine]:
    """Schema limpo com os papéis e privilégios padrão do Supabase, e as migrações aplicadas."""
    assert TEST_DATABASE_URL is not None
    engine = create_db_engine(TEST_DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
        for role in ("anon", "authenticated"):
            create = f"CREATE ROLE {role} NOLOGIN"
            connection.execute(
                text(f"DO $$ BEGIN {create}; EXCEPTION WHEN duplicate_object THEN NULL; END $$")
            )
        # No Supabase, toda tabela nova em public nasce acessível a anon/authenticated pela Data API.
        connection.execute(text("GRANT USAGE ON SCHEMA public TO anon, authenticated"))
        connection.execute(
            text("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated")
        )
    run_migrations(Settings(_env_file=None, database_url=TEST_DATABASE_URL))
    yield engine
    engine.dispose()


def test_migrations_match_the_models_on_postgres(migrated):
    with migrated.connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []


def test_every_table_has_row_level_security(migrated):
    with migrated.connect() as connection:
        query = text("SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY(:names)")
        rows = connection.execute(query, {"names": TABLES}).all()
    assert dict(rows) == dict.fromkeys(TABLES, True)


@pytest.mark.parametrize("role", ["anon", "authenticated"])
def test_public_api_roles_cannot_read(migrated, role):
    with migrated.connect() as connection:
        connection.execute(text(f"SET ROLE {role}"))
        with pytest.raises(ProgrammingError, match="permission denied"):
            connection.execute(text("SELECT * FROM airports"))
