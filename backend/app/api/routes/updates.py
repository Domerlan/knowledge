from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user_optional, get_db, require_role
from app.models.game_update import GameUpdate, GameUpdateAudit
from app.schemas.updates import (
    MediaUploadOut,
    UpdateAdminListOut,
    UpdateAdminOut,
    UpdateAuditOut,
    UpdateCreate,
    UpdateListOut,
    UpdatePublicDetail,
    UpdatePublishOut,
    UpdateUpdate,
)
from app.services.sanitize import sanitize_html

router = APIRouter(prefix="/updates", tags=["updates"])

MAX_PER_PAGE = 50
UPLOAD_CHUNK_SIZE = 1024 * 1024


def _paginate(page: int, per_page: int) -> tuple[int, int]:
    safe_page = max(page, 1)
    safe_per_page = max(1, min(per_page, MAX_PER_PAGE))
    return safe_page, safe_per_page


def _audit(
    db: Session,
    update_id: str,
    actor_id: str,
    action: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    entry = GameUpdateAudit(
        update_id=update_id,
        actor_id=actor_id,
        action=action,
        meta=metadata,
    )
    db.add(entry)


@router.get("", response_model=UpdateListOut)
def list_updates(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=MAX_PER_PAGE),
    db: Session = Depends(get_db),
) -> UpdateListOut:
    page, per_page = _paginate(page, per_page)
    base_query = db.query(GameUpdate).filter(
        GameUpdate.status == "published",
        GameUpdate.deleted_at.is_(None),
    )

    total = (
        db.query(func.count(GameUpdate.id))
        .filter(
            GameUpdate.status == "published",
            GameUpdate.deleted_at.is_(None),
        )
        .scalar()
        or 0
    )

    items = (
        base_query.order_by(GameUpdate.patch_date.desc(), GameUpdate.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return UpdateListOut(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total,
    )


@router.post("/media", response_model=MediaUploadOut)
def upload_update_media(
    file: UploadFile = File(...),
    _: object = Depends(require_role(["moderator", "admin"])),
) -> MediaUploadOut:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Only images are allowed"
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    subdir = Path(settings.media_dir) / "updates"
    subdir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{ext}"
    file_path = subdir / filename
    max_bytes = settings.media_max_mb * 1024 * 1024
    size = 0
    try:
        with file_path.open("wb") as out_file:
            while True:
                chunk = file.file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File too large",
                    )
                out_file.write(chunk)
    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save file",
        ) from exc

    url = f"{settings.media_url}/updates/{filename}"
    return MediaUploadOut(url=url, filename=filename, size=size)


@router.get("/{update_id}", response_model=UpdatePublicDetail)
def get_update(
    update_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
) -> UpdatePublicDetail:
    update = db.query(GameUpdate).filter(GameUpdate.id == update_id).first()
    if not update or update.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")

    is_staff = current_user and current_user.role in ["moderator", "admin"]
    if update.status != "published" and not is_staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")

    return update


@router.get("/admin/list", response_model=UpdateAdminListOut)
def list_updates_admin(
    status_filter: str | None = Query(default=None, alias="status"),
    query: str | None = Query(default=None, alias="q"),
    include_deleted: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=MAX_PER_PAGE),
    db: Session = Depends(get_db),
    _: object = Depends(require_role(["moderator", "admin"])),
) -> UpdateAdminListOut:
    page, per_page = _paginate(page, per_page)
    base_query = db.query(GameUpdate)

    if not include_deleted:
        base_query = base_query.filter(GameUpdate.deleted_at.is_(None))

    if status_filter:
        base_query = base_query.filter(GameUpdate.status == status_filter)

    if query:
        base_query = base_query.filter(GameUpdate.title.ilike(f"%{query}%"))

    total = base_query.with_entities(func.count(GameUpdate.id)).scalar() or 0
    items = (
        base_query.order_by(GameUpdate.patch_date.desc(), GameUpdate.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return UpdateAdminListOut(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        has_more=(page * per_page) < total,
    )


@router.post("", response_model=UpdateAdminOut, status_code=status.HTTP_201_CREATED)
def create_update(
    payload: UpdateCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["moderator", "admin"])),
) -> UpdateAdminOut:
    sanitized = sanitize_html(payload.content)
    update = GameUpdate(
        title=payload.title,
        patch_date=payload.patch_date,
        content=sanitized,
        status=payload.status,
        created_by_id=current_user.id,
    )

    if payload.status == "published":
        update.published_at = datetime.now(timezone.utc)
        update.published_by_id = current_user.id

    db.add(update)
    db.commit()
    db.refresh(update)

    _audit(
        db,
        update.id,
        current_user.id,
        "create",
        {"status": update.status, "title": update.title},
    )
    db.commit()

    return update


@router.patch("/{update_id}", response_model=UpdateAdminOut)
def update_update(
    update_id: str,
    payload: UpdateUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["moderator", "admin"])),
) -> UpdateAdminOut:
    update = db.query(GameUpdate).filter(GameUpdate.id == update_id).first()
    if not update or update.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")

    if payload.title is not None:
        update.title = payload.title
    if payload.patch_date is not None:
        update.patch_date = payload.patch_date
    if payload.content is not None:
        update.content = sanitize_html(payload.content)
    if payload.status is not None:
        update.status = payload.status
        if payload.status == "published":
            update.published_at = datetime.now(timezone.utc)
            update.published_by_id = current_user.id
        elif payload.status in ["draft", "archived"]:
            update.published_at = None
            update.published_by_id = None

    update.updated_by_id = current_user.id
    db.add(update)
    db.commit()
    db.refresh(update)

    _audit(
        db,
        update.id,
        current_user.id,
        "update",
        {"status": update.status, "title": update.title},
    )
    db.commit()

    return update


@router.post("/{update_id}/publish", response_model=UpdatePublishOut)
def publish_update(
    update_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["moderator", "admin"])),
) -> UpdatePublishOut:
    update = db.query(GameUpdate).filter(GameUpdate.id == update_id).first()
    if not update or update.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")

    update.status = "published"
    update.published_at = datetime.now(timezone.utc)
    update.published_by_id = current_user.id
    update.updated_by_id = current_user.id
    db.add(update)
    db.commit()

    _audit(db, update.id, current_user.id, "publish", {"title": update.title})
    db.commit()

    return UpdatePublishOut(status="published", published_at=update.published_at)


@router.post("/{update_id}/unpublish", response_model=UpdatePublishOut)
def unpublish_update(
    update_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["moderator", "admin"])),
) -> UpdatePublishOut:
    update = db.query(GameUpdate).filter(GameUpdate.id == update_id).first()
    if not update or update.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")

    update.status = "draft"
    update.published_at = None
    update.published_by_id = None
    update.updated_by_id = current_user.id
    db.add(update)
    db.commit()

    _audit(db, update.id, current_user.id, "unpublish", {"title": update.title})
    db.commit()

    return UpdatePublishOut(status="draft", published_at=None)


@router.delete("/{update_id}", response_model=UpdatePublishOut)
def delete_update(
    update_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["moderator", "admin"])),
) -> UpdatePublishOut:
    update = db.query(GameUpdate).filter(GameUpdate.id == update_id).first()
    if not update or update.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")

    update.deleted_at = datetime.now(timezone.utc)
    update.updated_by_id = current_user.id
    db.add(update)
    db.commit()

    _audit(db, update.id, current_user.id, "delete", {"title": update.title})
    db.commit()

    return UpdatePublishOut(status="deleted", published_at=update.published_at)


@router.post("/{update_id}/restore", response_model=UpdatePublishOut)
def restore_update(
    update_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["moderator", "admin"])),
) -> UpdatePublishOut:
    update = db.query(GameUpdate).filter(GameUpdate.id == update_id).first()
    if not update:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")

    update.deleted_at = None
    update.updated_by_id = current_user.id
    db.add(update)
    db.commit()

    _audit(db, update.id, current_user.id, "restore", {"title": update.title})
    db.commit()

    return UpdatePublishOut(status="restored", published_at=update.published_at)


@router.get("/{update_id}/audit", response_model=list[UpdateAuditOut])
def list_update_audit(
    update_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_role(["moderator", "admin"])),
) -> list[UpdateAuditOut]:
    return (
        db.query(GameUpdateAudit)
        .filter(GameUpdateAudit.update_id == update_id)
        .order_by(GameUpdateAudit.created_at.desc())
        .all()
    )
