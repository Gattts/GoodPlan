# Imagem da API do GoodPlan. O front é publicado à parte, no Cloudflare.
# Roda igual em qualquer hospedagem de containers (Render hoje, AWS Lightsail no futuro):
# toda a configuração vem de variáveis GP_*.

# 1. Build: instala as dependências travadas no uv.lock e o pacote num venv.
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never UV_NO_CACHE=1
WORKDIR /app
# Dependências primeiro: a camada é reaproveitada enquanto o uv.lock não muda.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY src ./src
RUN uv sync --locked --no-dev --no-editable

# 2. Execução: só o venv, sem uv nem ferramentas de build, com usuário sem privilégios.
FROM python:3.12-slim
WORKDIR /app
RUN useradd --system --uid 10001 --home-dir /app goodplan && mkdir -p /app/data && chown goodplan /app/data
COPY --from=build /app/.venv /app/.venv
USER goodplan
ENV PATH="/app/.venv/bin:$PATH" PORT=8000
EXPOSE 8000
# `serve` aplica as migrações antes de subir. A maioria das plataformas define $PORT.
CMD ["sh", "-c", "exec goodplan serve --host 0.0.0.0 --port \"$PORT\""]
