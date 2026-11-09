from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from goodplan.cli import run_migrations
from goodplan.config import Settings
from goodplan.db import create_db_engine
from goodplan.models import Base


def test_migrations_create_the_model_tables_on_sqlite(tmp_path):
    url = f"sqlite:///{tmp_path}/m.db"
    run_migrations(Settings(_env_file=None, database_url=url))
    engine = create_db_engine(url)
    with engine.connect() as connection:
        assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
    engine.dispose()
