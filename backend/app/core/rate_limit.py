from __future__ import annotations

import threading
import time

from fastapi import HTTPException, Request, status
from redis import Redis
from redis.exceptions import RedisError

from app.core.config import settings

_redis_client: Redis | None = None
_memory_cache: dict[str, tuple[int, float]] = {}
_lock = threading.Lock()


def _client_id(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _get_redis() -> Redis | None:
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        client = Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
        )
        client.ping()
        _redis_client = client
        return client
    except Exception:
        _redis_client = None
        return None


def _increment_redis(key: str, window_sec: int) -> int | None:
    client = _get_redis()
    if not client:
        return None
    try:
        count = int(client.incr(key))
        if count == 1:
            client.expire(key, window_sec)
        return count
    except RedisError:
        return None


def _increment_memory(key: str, window_sec: int) -> int:
    now = time.time()
    with _lock:
        count, expires_at = _memory_cache.get(key, (0, now + window_sec))
        if expires_at <= now:
            count = 0
            expires_at = now + window_sec
        count += 1
        _memory_cache[key] = (count, expires_at)
        return count


def enforce_rate_limit(
    request: Request,
    scope: str,
    limit: int,
    window_sec: int | None = None,
    identity: str | None = None,
) -> None:
    if not settings.rate_limit_enabled or limit <= 0:
        return

    window = window_sec or settings.rate_limit_window_sec
    client_id = _client_id(request)
    if identity:
        client_id = f"{client_id}:{identity}"
    key = f"rl:{scope}:{client_id}"

    count = _increment_redis(key, window)
    if count is None:
        count = _increment_memory(key, window)

    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests",
            headers={"Retry-After": str(window)},
        )
