from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    parent_id: str | None = None


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    article_id: str
    author_id: str
    parent_id: str | None
    content: str
    is_hidden: bool
    created_at: datetime
    updated_at: datetime | None
