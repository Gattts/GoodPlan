"""Segredos: a API só atende quem vem pelo Worker do Cloudflare (exceto /api/health)."""

import hmac

from fastapi import Request
from pydantic import SecretStr

from goodplan.errors import AppError

PROXY_HEADER = "X-Proxy-Secret"


def secrets_match(given: str | None, expected: SecretStr | None) -> bool:
    """Comparação em tempo constante: a demora da resposta não revela quanto do segredo acertou."""
    if given is None or expected is None:
        return False
    return hmac.compare_digest(given.encode(), expected.get_secret_value().encode())


def require_proxy_secret(request: Request) -> None:
    settings = request.app.state.settings
    if settings.proxy_only and not secrets_match(request.headers.get(PROXY_HEADER), settings.proxy_secret):
        raise AppError("Acesso direto não permitido.", 403)


def require_jobs_token(request: Request) -> None:
    """Sem token configurado, a rota nem existe (404); com token errado ou ausente, 401 sem dizer o motivo."""
    token = request.app.state.settings.jobs_token
    if token is None:
        raise AppError("Não encontrado.", 404)
    scheme, _, given = request.headers.get("Authorization", "").partition(" ")
    if scheme != "Bearer" or not secrets_match(given, token):
        raise AppError("Não autorizado.", 401)
