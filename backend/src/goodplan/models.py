"""Tabelas do banco. Toda tabela nova precisa de RLS na migração (o Supabase expõe o schema public)."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import BigInteger, Date, DateTime, Double, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# No SQLite, só INTEGER PRIMARY KEY gera o número sozinho; no Postgres, BIGINT.
ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class Base(DeclarativeBase):
    pass


class ExchangeRate(Base):
    """Uma linha por moeda por dia: quanto 1 real compra da moeda, como veio da fonte."""

    __tablename__ = "exchange_rates"

    currency: Mapped[str] = mapped_column(String(3), primary_key=True)
    rate_date: Mapped[date] = mapped_column(Date, primary_key=True)
    units_per_brl: Mapped[Decimal] = mapped_column(Numeric(24, 12))
    source: Mapped[str] = mapped_column(String(32))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Airport(Base):
    """Aeroporto com código IATA e voo regular, vindo do OurAirports."""

    __tablename__ = "airports"

    iata: Mapped[str] = mapped_column(String(3), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(120))
    city_pt: Mapped[str | None] = mapped_column(String(120))
    country_code: Mapped[str] = mapped_column(String(2))
    kind: Mapped[str] = mapped_column(String(16))
    latitude: Mapped[float] = mapped_column(Double)
    longitude: Mapped[float] = mapped_column(Double)
    currency: Mapped[str | None] = mapped_column(String(3))
    search_text: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class JobRun(Base):
    """Cada execução de rotina (câmbio, aeroportos): é aqui que se vê se a cotação de ontem chegou."""

    __tablename__ = "job_runs"
    __table_args__ = (Index("ix_job_runs_job_started_at", "job", "started_at"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    job: Mapped[str] = mapped_column(String(32))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(16))
    detail: Mapped[str] = mapped_column(Text, default="")
    fingerprint: Mapped[str | None] = mapped_column(String(64))
