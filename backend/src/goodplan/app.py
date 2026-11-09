"""Criação da aplicação FastAPI."""

from fastapi import APIRouter, Depends, FastAPI
from sqlalchemy.orm import sessionmaker

from goodplan.airports import routes as airports_routes
from goodplan.config import Settings, get_settings
from goodplan.db import create_db_engine
from goodplan.errors import register_error_handlers
from goodplan.http import HttpFactory, default_http_factory
from goodplan.jobs import routes as jobs_routes
from goodplan.jobs.runner import Clock, utc_now
from goodplan.rates import routes as rates_routes
from goodplan.security import require_proxy_secret


def create_app(
    settings: Settings | None = None,
    *,
    http_factory: HttpFactory | None = None,
    clock: Clock | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    engine = create_db_engine(settings.database_url)
    app = FastAPI(
        title="GoodPlan",
        docs_url="/api/docs" if settings.enable_docs else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.enable_docs else None,
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.sessionmaker = sessionmaker(engine, expire_on_commit=False)
    # Injetáveis para os testes: as fontes externas e o relógio nunca são os de verdade lá.
    app.state.http_factory = http_factory or default_http_factory
    app.state.clock = clock or utc_now
    register_error_handlers(app)
    app.include_router(_health_router())
    app.include_router(_protected_router())
    return app


def _health_router() -> APIRouter:
    # Fora do router protegido: o Render verifica a saúde sem passar pelo Worker.
    router = APIRouter(prefix="/api")

    @router.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return router


def _protected_router() -> APIRouter:
    """Rotas de dados: com GP_PROXY_ONLY, só respondem a quem traz o segredo do Worker."""
    router = APIRouter(prefix="/api", dependencies=[Depends(require_proxy_secret)])
    router.include_router(rates_routes.router)
    router.include_router(airports_routes.router)
    router.include_router(jobs_routes.router)
    return router
