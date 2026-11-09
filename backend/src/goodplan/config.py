"""Configuração lida de variáveis de ambiente com prefixo GP_ (ou do arquivo backend/.env)."""

from functools import lru_cache
from pathlib import Path
from typing import Self

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

BACKEND_DIR = Path(__file__).resolve().parents[2]
MIN_SECRET_LENGTH = 32
SUPABASE_HOST_SUFFIXES = (".supabase.co", ".supabase.com")
# Caminho absoluto: o banco local é o mesmo de qualquer pasta de onde o comando rodar.
DEFAULT_DATABASE_URL = f"sqlite:///{BACKEND_DIR / 'data' / 'goodplan.db'}"


def normalize_database_url(url: str) -> str:
    """Aceita a URL como o Supabase/Postgres entrega e devolve a forma que o SQLAlchemy usa.

    - `postgres://` e `postgresql://` passam a usar o driver psycopg 3;
    - no Supabase, a conexão exige SSL: sem `sslmode` na URL, usa `require`.
    """
    scheme, _, rest = url.partition("://")
    if scheme in ("postgres", "postgresql"):
        url = f"postgresql+psycopg://{rest}"
    if url.startswith("postgresql+psycopg://") and "sslmode=" not in url:
        host = make_url(url).host or ""
        if host.endswith(SUPABASE_HOST_SUFFIXES):
            url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


class Settings(BaseSettings):
    # env_ignore_empty: uma linha do .env sem valor (`GP_JOBS_TOKEN=`) vale o padrão, não uma string vazia.
    model_config = SettingsConfigDict(
        env_prefix="GP_",
        env_file=BACKEND_DIR / ".env",
        env_ignore_empty=True,
        extra="ignore",
    )

    database_url: str = DEFAULT_DATABASE_URL
    # Com a API publicada só para o Worker: recusa quem não manda o segredo (exceto /api/health).
    proxy_only: bool = False
    proxy_secret: SecretStr | None = None
    # Token da rota que roda as rotinas (câmbio, aeroportos). Sem ele, a rota não existe.
    jobs_token: SecretStr | None = None
    frankfurter_url: str = "https://api.frankfurter.dev"
    ourairports_url: str = "https://davidmegginson.github.io/ourairports-data/airports.csv"
    enable_docs: bool = False

    @field_validator("proxy_secret", "jobs_token")
    @classmethod
    def _require_long_secret(cls, value: SecretStr | None) -> SecretStr | None:
        # Um segredo curto pode ser adivinhado, e quem o conhece fala com a API como se fosse o Worker.
        if value is not None and len(value.get_secret_value()) < MIN_SECRET_LENGTH:
            raise ValueError(f"O segredo precisa ter pelo menos {MIN_SECRET_LENGTH} caracteres.")
        return value

    @model_validator(mode="after")
    def _proxy_only_needs_the_secret(self) -> Self:
        if self.proxy_only and self.proxy_secret is None:
            raise ValueError("GP_PROXY_ONLY=true exige GP_PROXY_SECRET.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
