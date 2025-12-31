from __future__ import annotations

import logging

import httpx

from app.celery_app import celery_app
from app.core.config import settings

logger = logging.getLogger("bdm.telegram")


@celery_app.task(
    bind=True,
    autoretry_for=(httpx.RequestError,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
)
def send_telegram_message(self, telegram_id: str, text: str) -> bool:
    if not settings.telegram_bot_token:
        return False

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": telegram_id,
        "text": text,
    }
    timeout = httpx.Timeout(10.0, connect=3.0)
    response = httpx.post(url, json=payload, timeout=timeout)
    if response.status_code == 200:
        return True
    if response.status_code == 429 or response.status_code >= 500:
        logger.warning(
            "telegram_send_retry status=%s body=%s",
            response.status_code,
            response.text[:200],
        )
        raise self.retry()
    logger.warning(
        "telegram_send_failed status=%s body=%s",
        response.status_code,
        response.text[:200],
    )
    return False
