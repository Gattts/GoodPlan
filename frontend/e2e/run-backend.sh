#!/usr/bin/env bash
# Sobe a API com um banco de teste e os dados de exemplo do backend (sem internet) para os testes de ponta a ponta.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
DATA_DIR="$(mktemp -d)"
trap 'rm -rf "$DATA_DIR"' EXIT
# Definido aqui para valer mais que o backend/.env, que pode apontar para o banco de verdade.
# Na CI, GP_E2E_DATABASE_URL aponta para o Postgres do Actions; localmente, um SQLite temporário.
export GP_DATABASE_URL="${GP_E2E_DATABASE_URL:-sqlite:///$DATA_DIR/e2e.db}"
export GP_PROXY_ONLY=false
cd "$(dirname "$0")/../../backend"
uv run goodplan migrate
uv run goodplan jobs run rates --file tests/fixtures/frankfurter_brl.json
uv run goodplan jobs run airports --file tests/fixtures/airports_sample.csv
uv run goodplan serve --host 127.0.0.1 --port "$E2E_API_PORT"
