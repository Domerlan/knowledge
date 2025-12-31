import asyncio

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.types import Message

from config import settings


def build_bot() -> Bot:
    if not settings.telegram_bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set")
    return Bot(token=settings.telegram_bot_token)


dp = Dispatcher()


@dp.message(CommandStart())
async def start_handler(message: Message) -> None:
    await message.answer("Отправьте код подтверждения, чтобы завершить регистрацию.")


@dp.message(F.text & ~F.text.startswith("/"))
async def confirm_handler(message: Message) -> None:
    code = message.text.strip()
    if not code:
        await message.answer("Код не может быть пустым.")
        return

    payload = {
        "code": code,
        "telegram_id": str(message.from_user.id),
        "telegram_username": message.from_user.username,
    }
    headers = {}
    if settings.telegram_confirm_token:
        headers["X-Bot-Token"] = settings.telegram_confirm_token

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{settings.backend_base_url}/api/telegram/confirm",
                json=payload,
                headers=headers,
            )
    except httpx.RequestError:
        await message.answer("Не удалось связаться с сервером. Попробуйте позже.")
        return

    if response.status_code == 200:
        await message.answer("Регистрация подтверждена. Теперь вы можете войти.")
        return

    detail = "Подтверждение не удалось. Проверьте код."
    try:
        data = response.json()
        if isinstance(data, dict) and "detail" in data:
            detail = f"Подтверждение не удалось: {data['detail']}"
    except ValueError:
        pass

    await message.answer(detail)


async def main() -> None:
    bot = build_bot()
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
