from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InstallationState(Base):
    __tablename__ = "installation_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    installed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    admin_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    seed_applied: Mapped[bool] = mapped_column(Boolean, default=False)

    admin_user = relationship("User")
