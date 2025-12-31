from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import StrictBaseModel


class SectionBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=128)
    description: str | None = None
    sort_order: int = 0
    is_visible: bool = True


class SectionInBase(StrictBaseModel):
    title: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=128)
    description: str | None = None
    sort_order: int = 0
    is_visible: bool = True


class SectionCreate(SectionInBase):
    pass


class SectionOut(SectionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
