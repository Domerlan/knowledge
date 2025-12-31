from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    telegram_bot_token: str = Field("", alias="TELEGRAM_BOT_TOKEN")
    backend_base_url: str = Field("http://127.0.0.1:8000", alias="BACKEND_BASE_URL")
    telegram_confirm_token: str = Field("", alias="TELEGRAM_CONFIRM_TOKEN")


settings = Settings()
