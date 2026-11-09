"""Erros da API, sempre no formato {"detail": "mensagem em português"}."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

NOT_FOUND = 404


class AppError(Exception):
    """Erro esperado, com a mensagem que a pessoa vê e o status HTTP."""

    def __init__(self, message: str, status: int) -> None:
        super().__init__(message)
        self.message = message
        self.status = status


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)


async def _app_error(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, AppError):  # o Starlette só chama este tratador para AppError
        raise exc
    return JSONResponse({"detail": exc.message}, status_code=exc.status)


async def _validation_error(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse({"detail": "Parâmetros inválidos."}, status_code=422)


async def _http_error(_request: Request, exc: Exception) -> JSONResponse:
    if not isinstance(exc, StarletteHTTPException):  # o Starlette só chama este tratador para HTTPException
        raise exc
    detail = "Não encontrado." if exc.status_code == NOT_FOUND else exc.detail
    return JSONResponse({"detail": detail}, status_code=exc.status_code, headers=exc.headers)
