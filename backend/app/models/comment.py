from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.utils import generate_uuid


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    article_id: Mapped[str] = mapped_column(String(36), ForeignKey("articles.id"), index=True)
    author_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    parent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("comments.id"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    article = relationship("Article", back_populates="comments")
    author = relationship("User", back_populates="comments")
