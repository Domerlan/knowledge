from __future__ import annotations

from datetime import datetime, timezone

from app.celery_app import celery_app
from app.db.session import SessionLocal
from app.models.registration_request import RegistrationRequest


@celery_app.task
def cleanup_expired_registration_requests() -> int:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        expired = (
            db.query(RegistrationRequest)
            .filter(
                RegistrationRequest.status == "pending",
                RegistrationRequest.expires_at <= now,
            )
            .all()
        )
        for request in expired:
            request.status = "expired"
            db.add(request)
        db.commit()
        return len(expired)
    finally:
        db.close()
