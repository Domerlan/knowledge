from __future__ import annotations

import asyncio
import logging
import time
import uuid
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from redis.exceptions import RedisError
from sqlalchemy.exc import SQLAlchemyError
from starlette.responses import JSONResponse

from app.api.api import api_router
from app.core.config import settings


class _DefaultLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        defaults = {
            "request_id": "-",
            "method": "-",
            "path": "-",
            "status_code": "-",
            "duration_ms": "-",
            "client_ip": "-",
        }
        for key, value in defaults.items():
            if not hasattr(record, key):
                setattr(record, key, value)
        return True


LOG_FORMAT = (
    "%(asctime)s %(levelname)s %(name)s %(message)s "
    "request_id=%(request_id)s method=%(method)s path=%(path)s "
    "status=%(status_code)s duration_ms=%(duration_ms)s client_ip=%(client_ip)s"
)
logging.basicConfig(level=settings.log_level.upper(), format=LOG_FORMAT)
logging.getLogger().addFilter(_DefaultLogFilter())

logger = logging.getLogger("bdm")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    handler.addFilter(_DefaultLogFilter())
    logger.addHandler(handler)
    logger.propagate = False

app = FastAPI(title="BDM Knowledge Base")
app.include_router(api_router, prefix="/api")

media_path = Path(settings.media_dir)
media_path.mkdir(parents=True, exist_ok=True)
app.mount(settings.media_url, StaticFiles(directory=media_path), name="media")

if settings.cors_allow_origins:
    origins = [
        origin.strip() for origin in settings.cors_allow_origins.split(",") if origin.strip()
    ]
    if origins:
        if "*" in origins:
            message = "CORS_ALLOW_ORIGINS cannot include '*' when credentials are enabled"
            if settings.app_env == "production":
                raise RuntimeError(message)
            logger.warning(message)
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )


def _log_extra(request: Request) -> dict[str, object]:
    return {
        "request_id": getattr(request.state, "request_id", None),
        "method": request.method,
        "path": request.url.path,
        "client_ip": request.client.host if request.client else None,
    }


def _service_unavailable(request: Request, detail: str) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    payload = {"detail": detail}
    if request_id:
        payload["request_id"] = request_id
    return JSONResponse(status_code=503, content=payload)


def _error_payload(request: Request, detail: object, code: str) -> dict[str, object]:
    if isinstance(detail, dict):
        payload: dict[str, object] = dict(detail)
    elif isinstance(detail, list):
        payload = {"detail": detail}
    else:
        payload = {"detail": detail}
    payload.setdefault("code", code)
    payload.setdefault("request_id", getattr(request.state, "request_id", None))
    return payload


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    payload = _error_payload(request, exc.detail, f"http_{exc.status_code}")
    return JSONResponse(status_code=exc.status_code, content=payload)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    payload = _error_payload(request, exc.errors(), "validation_error")
    return JSONResponse(status_code=422, content=payload)


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("Database error", extra=_log_extra(request))
    return _service_unavailable(request, "Database unavailable")


@app.exception_handler(RedisError)
async def redis_error_handler(request: Request, exc: RedisError):
    logger.exception("Redis error", extra=_log_extra(request))
    return _service_unavailable(request, "Cache unavailable")


@app.exception_handler(httpx.RequestError)
async def httpx_error_handler(request: Request, exc: httpx.RequestError):
    logger.exception("HTTP client error", extra=_log_extra(request))
    return _service_unavailable(request, "Upstream service unavailable")


@app.exception_handler(asyncio.TimeoutError)
async def timeout_error_handler(request: Request, exc: asyncio.TimeoutError):
    logger.exception("Timeout error", extra=_log_extra(request))
    return _service_unavailable(request, "Upstream service timeout")


@app.middleware("http")
async def request_logger(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    start = time.time()
    response = await call_next(request)
    duration = (time.time() - start) * 1000

    logger.info(
        "request",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration, 2),
            "client_ip": request.client.host if request.client else None,
        },
    )
    response.headers["X-Request-ID"] = request_id
    return response
