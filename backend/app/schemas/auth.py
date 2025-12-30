from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^@[A-Za-z0-9_]{3,32}$")
    password: str = Field(min_length=8, max_length=128)


class RegisterOut(BaseModel):
    status: str
    code: str
    expires_at: datetime


class RegisterStatusIn(BaseModel):
    code: str = Field(min_length=4, max_length=16)


class RegisterStatusOut(BaseModel):
    status: str


class LoginIn(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^@[A-Za-z0-9_]{3,32}$")
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    role: str
    telegram_id: str | None
    is_active: bool
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserOut


class TelegramConfirmIn(BaseModel):
    code: str = Field(min_length=4, max_length=16)
    telegram_id: str = Field(min_length=3, max_length=32)
    telegram_username: str | None = Field(
        default=None,
        min_length=3,
        max_length=32,
        pattern=r"^[A-Za-z0-9_]{3,32}$",
    )


class TelegramConfirmOut(BaseModel):
    status: str
    message: str
