from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db
from app.core.security import decode_token, generate_confirm_code, hash_confirm_code, hash_password, verify_password
from app.models.registration_request import RegistrationRequest
from app.models.user import User
from app.core.deps import get_current_user
from app.schemas.auth import (
    AuthResponse,
    LoginIn,
    RegisterIn,
    RegisterOut,
    RegisterStatusIn,
    RegisterStatusOut,
    UserOut,
)
from app.services.auth import build_tokens, clear_auth_cookies, set_auth_cookies

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn, response: Response, db: Session = Depends(get_db)) -> RegisterOut:
    username = payload.username.strip()
    if not username.startswith("@"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username must start with @")

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")

    now = datetime.now(timezone.utc)
    existing_request = (
        db.query(RegistrationRequest)
        .filter(RegistrationRequest.username == username, RegistrationRequest.status == "pending")
        .order_by(RegistrationRequest.created_at.desc())
        .first()
    )
    if existing_request:
        expires_at = existing_request.expires_at
        compare_now = now if expires_at.tzinfo else now.replace(tzinfo=None)
        if expires_at > compare_now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration already pending",
            )
        existing_request.status = "expired"
        db.add(existing_request)
        db.commit()

    code = generate_confirm_code()
    code_hash = hash_confirm_code(code)
    while db.query(RegistrationRequest).filter(RegistrationRequest.code_hash == code_hash).first():
        code = generate_confirm_code()
        code_hash = hash_confirm_code(code)

    expires_at = now + timedelta(minutes=settings.tg_confirm_code_ttl_min)
    registration = RegistrationRequest(
        username=username,
        password_hash=hash_password(payload.password),
        code_hash=code_hash,
        expires_at=expires_at,
        attempts=0,
        status="pending",
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)

    response.status_code = status.HTTP_201_CREATED
    return RegisterOut(status="pending", code=code, expires_at=registration.expires_at)


@router.post("/register/status", response_model=RegisterStatusOut)
def register_status(payload: RegisterStatusIn, db: Session = Depends(get_db)) -> RegisterStatusOut:
    code_hash = hash_confirm_code(payload.code.strip().upper())
    request = db.query(RegistrationRequest).filter(RegistrationRequest.code_hash == code_hash).first()
    if not request:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid code")

    if request.status == "pending":
        now = datetime.now(timezone.utc)
        expires_at = request.expires_at
        compare_now = now if expires_at.tzinfo else now.replace(tzinfo=None)
        if expires_at <= compare_now:
            request.status = "expired"
            db.add(request)
            db.commit()

    return RegisterStatusOut(status=request.status)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")

    tokens = build_tokens(user.id)
    set_auth_cookies(response, tokens)
    return AuthResponse(user=user)


@router.post("/refresh", response_model=AuthResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    token = request.cookies.get(settings.refresh_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    tokens = build_tokens(user.id)
    set_auth_cookies(response, tokens)
    return AuthResponse(user=user)


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    clear_auth_cookies(response)
    return {"status": "ok"}


@router.get("/me", response_model=UserOut)
def me(current_user=Depends(get_current_user)) -> UserOut:
    return current_user
