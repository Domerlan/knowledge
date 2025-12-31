from __future__ import annotations

from datetime import datetime, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db
from app.core.rate_limit import enforce_rate_limit
from app.core.security import hash_confirm_code
from app.models.registration_request import RegistrationRequest
from app.models.user import User
from app.schemas.auth import TelegramConfirmIn, TelegramConfirmOut

router = APIRouter(prefix="/telegram", tags=["telegram"])


def _require_bot_token(request: Request) -> None:
    if settings.app_env != "production":
        return
    expected = settings.telegram_confirm_token
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Telegram confirm token not configured",
        )
    token = request.headers.get("X-Bot-Token")
    if not token or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bot token")


@router.post("/confirm", response_model=TelegramConfirmOut)
def confirm_registration(
    payload: TelegramConfirmIn,
    request: Request,
    db: Session = Depends(get_db),
) -> TelegramConfirmOut:
    enforce_rate_limit(
        request,
        "telegram:confirm",
        settings.rate_limit_confirm_max,
        identity=payload.telegram_id,
    )
    _require_bot_token(request)
    code_hash = hash_confirm_code(payload.code.strip().upper())
    registration = db.query(RegistrationRequest).filter(RegistrationRequest.code_hash == code_hash).first()
    if not registration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid code")

    if registration.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    telegram_username = (payload.telegram_username or "").strip().lstrip("@")
    if not telegram_username:
        registration.status = "rejected"
        db.add(registration)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram username не задан. Установите @username в Telegram и зарегистрируйтесь заново.",
        )
    expected_username = registration.username.lstrip("@").lower()
    if telegram_username.lower() != expected_username:
        registration.status = "rejected"
        db.add(registration)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Telegram username не совпадает с регистрацией. "
                f"В Telegram: @{telegram_username}, в регистрации: {registration.username}."
            ),
        )

    now = datetime.now(timezone.utc)
    expires_at = registration.expires_at
    compare_now = now if expires_at.tzinfo else now.replace(tzinfo=None)
    if expires_at <= compare_now:
        registration.status = "expired"
        db.add(registration)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code expired")

    if registration.attempts >= settings.tg_confirm_max_attempts:
        registration.status = "rejected"
        db.add(registration)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attempts exceeded")

    registration.attempts += 1

    existing_user = db.query(User).filter(User.username == registration.username).first()
    if existing_user:
        registration.status = "rejected"
        db.add(registration)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    existing_telegram = db.query(User).filter(User.telegram_id == payload.telegram_id).first()
    if existing_telegram:
        registration.status = "rejected"
        db.add(registration)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Telegram already linked")

    user = User(
        username=registration.username,
        password_hash=registration.password_hash,
        role="user",
        telegram_id=payload.telegram_id,
        is_active=True,
    )

    registration.status = "approved"
    registration.telegram_id = payload.telegram_id

    db.add(user)
    db.add(registration)
    db.commit()

    return TelegramConfirmOut(status="approved", message="Registration confirmed")
