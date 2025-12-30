from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "bdm",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.timezone = "UTC"
celery_app.conf.beat_schedule = {
    "cleanup-expired-registrations": {
        "task": "app.tasks.cleanup.cleanup_expired_registration_requests",
        "schedule": 900.0,
    }
}

celery_app.autodiscover_tasks(["app.tasks"])
