from __future__ import annotations

import httpx

from app.celery_app import celery_app
from app.core.config import settings


@celery_app.task
def send_telegram_message(telegram_id: str, text: str) -> bool:
    if not settings.telegram_bot_token:
        return False

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": telegram_id,
        "text": text,
    }
    response = httpx.post(url, json=payload, timeout=10)
    return response.status_code == 200
