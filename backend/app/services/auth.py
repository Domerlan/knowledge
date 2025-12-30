from __future__ import annotations

from datetime import timedelta

from fastapi import Response

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token


class AuthTokens:
    def __init__(self, access_token: str, refresh_token: str):
        self.access_token = access_token
        self.refresh_token = refresh_token


def build_tokens(user_id: str) -> AuthTokens:
    return AuthTokens(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


def set_auth_cookies(response: Response, tokens: AuthTokens) -> None:
    max_age_access = int(timedelta(minutes=settings.jwt_access_ttl_min).total_seconds())
    max_age_refresh = int(timedelta(days=settings.jwt_refresh_ttl_days).total_seconds())
    secure = settings.app_env == "production"

    response.set_cookie(
        settings.access_cookie_name,
        tokens.access_token,
        httponly=True,
        max_age=max_age_access,
        samesite="lax",
        secure=secure,
        path="/",
    )
    response.set_cookie(
        settings.refresh_cookie_name,
        tokens.refresh_token,
        httponly=True,
        max_age=max_age_refresh,
        samesite="lax",
        secure=secure,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(settings.access_cookie_name, path="/")
    response.delete_cookie(settings.refresh_cookie_name, path="/")
