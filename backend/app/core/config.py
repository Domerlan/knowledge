from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_env: str = Field("production", alias="APP_ENV")
    base_url: str = Field("http://localhost:3000", alias="BASE_URL")

    db_host: str = Field("127.0.0.1", alias="DB_HOST")
    db_port: int = Field(3306, alias="DB_PORT")
    db_name: str = Field("bdm_kb", alias="DB_NAME")
    db_user: str = Field("bdm_app", alias="DB_USER")
    db_password: str = Field("", alias="DB_PASSWORD")

    database_url: str | None = Field(default=None, alias="DATABASE_URL")

    redis_url: str = Field("redis://127.0.0.1:6379/0", alias="REDIS_URL")
    cors_allow_origins: str | None = Field(default=None, alias="CORS_ALLOW_ORIGINS")

    jwt_secret: str = Field("CHANGE_ME", alias="JWT_SECRET")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    jwt_access_ttl_min: int = Field(15, alias="JWT_ACCESS_TTL_MIN")
    jwt_refresh_ttl_days: int = Field(30, alias="JWT_REFRESH_TTL_DAYS")

    access_cookie_name: str = Field("access_token", alias="ACCESS_COOKIE_NAME")
    refresh_cookie_name: str = Field("refresh_token", alias="REFRESH_COOKIE_NAME")

    telegram_bot_token: str = Field("", alias="TELEGRAM_BOT_TOKEN")
    tg_confirm_code_ttl_min: int = Field(10, alias="TG_CONFIRM_CODE_TTL_MIN")
    tg_confirm_max_attempts: int = Field(5, alias="TG_CONFIRM_MAX_ATTEMPTS")

    installer_enabled: bool = Field(False, alias="INSTALLER_ENABLED")
    installer_token: str = Field("", alias="INSTALLER_TOKEN")

    media_dir: str = Field("/opt/bdm-knowledge/uploads", alias="MEDIA_DIR")
    media_url: str = Field("/api/media", alias="MEDIA_URL")
    media_max_mb: int = Field(10, alias="MEDIA_MAX_MB")
    iframe_allowed_hosts: str = Field(
        "youtube.com,youtu.be,youtube-nocookie.com,vk.com,vk.ru,player.vk.com",
        alias="IFRAME_ALLOWED_HOSTS",
    )

    def sqlalchemy_database_uri(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            "mysql+pymysql://"
            f"{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/"
            f"{self.db_name}?charset=utf8mb4"
        )


settings = Settings()
