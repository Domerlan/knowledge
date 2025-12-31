from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings


def _build_engine():
    database_uri = settings.sqlalchemy_database_uri()
    connect_args: dict[str, object] = {}
    engine_kwargs: dict[str, object] = {
        "pool_pre_ping": True,
        "future": True,
    }

    if database_uri.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if database_uri.endswith(":memory:"):
            engine_kwargs["poolclass"] = StaticPool
    else:
        connect_args["connect_timeout"] = 5
        connect_args["read_timeout"] = 10
        connect_args["write_timeout"] = 10

    return create_engine(database_uri, connect_args=connect_args, **engine_kwargs)


engine = _build_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
