from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ArticleBase(BaseModel):
    section_id: str
    slug: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=255)
    content: str


class ArticleCreate(ArticleBase):
    status: Literal["draft", "published", "archived"] = Field(default="draft")


class ArticleUpdate(BaseModel):
    section_id: str | None = None
    slug: str | None = None
    title: str | None = None
    content: str | None = None
    status: Literal["draft", "published", "archived"] | None = None


class ArticleOut(ArticleBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    author_id: str
    created_at: datetime
    updated_at: datetime | None
    published_at: datetime | None
