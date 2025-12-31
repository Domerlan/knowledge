from __future__ import annotations

import secrets

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_db
from app.services.installer import is_installed


def require_installer_token(request: Request) -> None:
    if not settings.installer_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Installer disabled")

    token = request.headers.get("X-Installer-Token")
    if not token or not settings.installer_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid installer token"
        )
    if not secrets.compare_digest(token, settings.installer_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid installer token"
        )


def require_installer_available(
    db: Session = Depends(get_db), _: None = Depends(require_installer_token)
) -> None:
    if is_installed(db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Installer already completed"
        )
