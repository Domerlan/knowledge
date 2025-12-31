from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role
from app.models.section import Section
from app.schemas.sections import SectionCreate, SectionOut

router = APIRouter(prefix="/sections", tags=["sections"])


@router.get("", response_model=list[SectionOut])
def list_sections(db: Session = Depends(get_db)) -> list[SectionOut]:
    sections = (
        db.query(Section)
        .filter(Section.is_visible.is_(True))
        .order_by(Section.sort_order.asc())
        .all()
    )
    return sections


@router.get("/all", response_model=list[SectionOut])
def list_all_sections(
    db: Session = Depends(get_db),
    _: object = Depends(require_role(["moderator", "admin"])),
) -> list[SectionOut]:
    sections = db.query(Section).order_by(Section.sort_order.asc()).all()
    return sections


@router.post("", response_model=SectionOut, status_code=status.HTTP_201_CREATED)
def create_section(
    payload: SectionCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_role(["moderator", "admin"])),
) -> SectionOut:
    existing = db.query(Section).filter(Section.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug already exists")

    section = Section(
        title=payload.title,
        slug=payload.slug,
        description=payload.description,
        sort_order=payload.sort_order,
        is_visible=payload.is_visible,
    )
    db.add(section)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug already exists") from None
    db.refresh(section)
    return section
