"""Tabelas iniciais: cotações, aeroportos e execuções de rotinas, com RLS no Postgres.

Revision ID: 0001
Revises:
Create Date: 2026-11-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("exchange_rates", "airports", "job_runs", "alembic_version")
# Papéis da Data API do Supabase: sem permissão nenhuma nas tabelas (a API conecta como dona delas).
PUBLIC_ROLES = ("anon", "authenticated")


def upgrade() -> None:
    op.create_table(
        "exchange_rates",
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("rate_date", sa.Date(), nullable=False),
        sa.Column("units_per_brl", sa.Numeric(precision=24, scale=12), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("currency", "rate_date"),
    )
    op.create_table(
        "airports",
        sa.Column("iata", sa.String(length=3), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("city_pt", sa.String(length=120), nullable=True),
        sa.Column("country_code", sa.String(length=2), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("latitude", sa.Double(), nullable=False),
        sa.Column("longitude", sa.Double(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("search_text", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("iata"),
    )
    op.create_table(
        "job_runs",
        sa.Column(
            "id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), autoincrement=True, nullable=False
        ),
        sa.Column("job", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_runs_job_started_at", "job_runs", ["job", "started_at"])

    if op.get_bind().dialect.name == "postgresql":
        for table in TABLES:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        tables = ", ".join(TABLES)
        for role in PUBLIC_ROLES:
            # Só constantes deste arquivo entram no SQL (nada vem de fora).
            op.execute(
                f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role}') THEN "  # noqa: S608
                f"REVOKE ALL ON TABLE {tables} FROM {role}; END IF; END $$"
            )


def downgrade() -> None:
    op.drop_index("ix_job_runs_job_started_at", table_name="job_runs")
    op.drop_table("job_runs")
    op.drop_table("airports")
    op.drop_table("exchange_rates")
