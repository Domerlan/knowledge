from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import StrictBaseModel


class UpdateBase(StrictBaseModel):
    title: str = Field(min_length=2, max_length=255)
    patch_date: date
    content: str = Field(min_length=1)


class UpdateCreate(UpdateBase):
    status: str = Field(default="draft", pattern="^(draft|published|archived)$")


class UpdateUpdate(StrictBaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    patch_date: date | None = None
    content: str | None = Field(default=None, min_length=1)
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")


class UpdatePublicListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    patch_date: date


class UpdatePublicDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    patch_date: date
    content: str
    published_at: datetime | None


class UpdateAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    patch_date: date
    content: str
    status: str
    created_by_id: str
    updated_by_id: str | None
    published_by_id: str | None
    created_at: datetime
    updated_at: datetime | None
    published_at: datetime | None
    deleted_at: datetime | None


class UpdateListOut(BaseModel):
    items: list[UpdatePublicListItem]
    total: int
    page: int
    per_page: int
    has_more: bool


class UpdateAdminListOut(BaseModel):
    items: list[UpdateAdminOut]
    total: int
    page: int
    per_page: int
    has_more: bool


class UpdateAuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    update_id: str
    actor_id: str
    action: str
    metadata: dict | None = Field(default=None, validation_alias="meta")
    created_at: datetime


class UpdatePublishOut(BaseModel):
    status: str
    published_at: datetime | None = None


class MediaUploadOut(BaseModel):
    url: str
    filename: str
    size: int
