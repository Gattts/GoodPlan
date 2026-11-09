import pytest

from goodplan.config import Settings, normalize_database_url


def test_postgres_urls_use_psycopg_and_supabase_requires_ssl():
    assert (
        normalize_database_url("postgres://u:p@db.local:5432/x") == "postgresql+psycopg://u:p@db.local:5432/x"
    )
    supabase = normalize_database_url("postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:5432/postgres")
    assert supabase.endswith("?sslmode=require")


def test_sqlite_urls_are_left_alone():
    assert normalize_database_url("sqlite:///tmp/x.db") == "sqlite:///tmp/x.db"


def test_secrets_need_32_characters():
    with pytest.raises(ValueError, match="32 caracteres"):
        Settings(_env_file=None, proxy_secret="curto")


def test_proxy_only_requires_the_secret():
    with pytest.raises(ValueError, match="GP_PROXY_SECRET"):
        Settings(_env_file=None, proxy_only=True)


def test_default_database_is_a_local_sqlite_file(monkeypatch):
    monkeypatch.delenv("GP_DATABASE_URL", raising=False)
    assert Settings(_env_file=None).database_url.startswith("sqlite:///")
