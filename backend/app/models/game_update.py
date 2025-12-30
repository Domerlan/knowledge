from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.utils import generate_uuid


class GameUpdate(Base):
    __tablename__ = "game_updates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(255))
    patch_date: Mapped[date] = mapped_column(Date)
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        Enum("draft", "published", "archived", name="game_update_status", native_enum=False),
        default="draft",
    )

    created_by_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    updated_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    published_by_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GameUpdateAudit(Base):
    __tablename__ = "game_update_audits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    update_id: Mapped[str] = mapped_column(String(36), ForeignKey("game_updates.id"), index=True)
    actor_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(32))
    meta: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
