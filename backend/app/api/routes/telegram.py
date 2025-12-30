from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db
from app.core.security import hash_confirm_code
from app.models.registration_request import RegistrationRequest
from app.models.user import User
from app.schemas.auth import TelegramConfirmIn, TelegramConfirmOut

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/confirm", response_model=TelegramConfirmOut)
def confirm_registration(payload: TelegramConfirmIn, db: Session = Depends(get_db)) -> TelegramConfirmOut:
    code_hash = hash_confirm_code(payload.code.strip().upper())
    request = db.query(RegistrationRequest).filter(RegistrationRequest.code_hash == code_hash).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid code")

    if request.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request is not pending")

    telegram_username = (payload.telegram_username or "").strip().lstrip("@")
    if not telegram_username:
        request.status = "rejected"
        db.add(request)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Telegram username не задан. Установите @username в Telegram и зарегистрируйтесь заново.",
        )
    expected_username = request.username.lstrip("@").lower()
    if telegram_username.lower() != expected_username:
        request.status = "rejected"
        db.add(request)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Telegram username не совпадает с регистрацией. "
                f"В Telegram: @{telegram_username}, в регистрации: {request.username}."
            ),
        )

    now = datetime.now(timezone.utc)
    expires_at = request.expires_at
    compare_now = now if expires_at.tzinfo else now.replace(tzinfo=None)
    if expires_at <= compare_now:
        request.status = "expired"
        db.add(request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code expired")

    if request.attempts >= settings.tg_confirm_max_attempts:
        request.status = "rejected"
        db.add(request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attempts exceeded")

    request.attempts += 1

    existing_user = db.query(User).filter(User.username == request.username).first()
    if existing_user:
        request.status = "rejected"
        db.add(request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    existing_telegram = db.query(User).filter(User.telegram_id == payload.telegram_id).first()
    if existing_telegram:
        request.status = "rejected"
        db.add(request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Telegram already linked")

    user = User(
        username=request.username,
        password_hash=request.password_hash,
        role="user",
        telegram_id=payload.telegram_id,
        is_active=True,
    )

    request.status = "approved"
    request.telegram_id = payload.telegram_id

    db.add(user)
    db.add(request)
    db.commit()

    return TelegramConfirmOut(status="approved", message="Registration confirmed")
