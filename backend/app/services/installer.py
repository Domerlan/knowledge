from __future__ import annotations

import os
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.installation_state import InstallationState
from app.models.user import User
from app.services.seed import seed_articles, seed_sections


def check_database(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except SQLAlchemyError:
        return False


def is_installed(db: Session) -> bool:
    try:
        inspector = inspect(db.get_bind())
        if "installation_state" not in inspector.get_table_names():
            return False
        return db.query(InstallationState).first() is not None
    except SQLAlchemyError:
        return False


def run_migrations(database_uri: str | None = None) -> None:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    alembic_ini = os.path.join(base_dir, "alembic.ini")
    alembic_cfg = Config(alembic_ini)
    sqlalchemy_url = database_uri or settings.sqlalchemy_database_uri()
    alembic_cfg.set_main_option("sqlalchemy.url", sqlalchemy_url)

    engine = create_engine(sqlalchemy_url, pool_pre_ping=True, future=True)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
    finally:
        engine.dispose()

    if "alembic_version" not in tables and tables:
        core_tables = {"users", "sections", "articles", "comments", "registration_requests"}
        missing_core = core_tables - tables
        if missing_core:
            raise RuntimeError(
                "Database has existing tables but no alembic_version. "
                f"Missing core tables: {', '.join(sorted(missing_core))}"
            )
        if "installation_state" in tables:
            command.stamp(alembic_cfg, "head")
            return
        command.stamp(alembic_cfg, "0001_create_tables")
        command.upgrade(alembic_cfg, "head")
        return

    command.upgrade(alembic_cfg, "head")


def seed_database(db: Session, author: User, upsert: bool) -> None:
    sections = seed_sections(db, upsert=upsert)
    seed_articles(db, author, sections, upsert=upsert)


def mark_installed(db: Session, admin_user_id: str | None, seed_applied: bool) -> InstallationState:
    state = db.query(InstallationState).first()
    if state:
        state.installed_at = datetime.now(timezone.utc)
        state.admin_user_id = admin_user_id
        state.seed_applied = seed_applied
        db.add(state)
        db.commit()
        db.refresh(state)
        return state

    state = InstallationState(
        installed_at=datetime.now(timezone.utc),
        admin_user_id=admin_user_id,
        seed_applied=seed_applied,
    )
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


def get_state_snapshot() -> dict[str, bool]:
    db = SessionLocal()
    try:
        db_ok = check_database(db)
        installed = is_installed(db) if db_ok else False
        return {"db_ok": db_ok, "installed": installed}
    finally:
        db.close()


def check_tcp(host: str, port: int, timeout_ms: int | None = None) -> tuple[bool, str | None]:
    timeout = (timeout_ms or 2000) / 1000
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, None
    except OSError as exc:
        return False, str(exc)


def default_host_checks() -> list[dict[str, object]]:
    items: list[dict[str, object]] = [
        {"name": "database", "host": settings.db_host, "port": settings.db_port},
    ]

    parsed = urlparse(settings.redis_url)
    redis_host = parsed.hostname or "127.0.0.1"
    redis_port = parsed.port or 6379
    items.append({"name": "redis", "host": redis_host, "port": redis_port})

    return items
