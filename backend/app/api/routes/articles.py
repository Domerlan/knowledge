from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user_optional, get_db, require_role
from app.models.article import Article
from app.models.section import Section
from app.schemas.articles import ArticleCreate, ArticleOut, ArticleUpdate

router = APIRouter(prefix="/articles", tags=["articles"])


@router.get("", response_model=list[ArticleOut])
def list_articles(section: str | None = None, db: Session = Depends(get_db)) -> list[ArticleOut]:
    query = db.query(Article).filter(Article.status == "published")

    if section:
        section_obj = db.query(Section).filter(Section.slug == section).first()
        if not section_obj:
            return []
        query = query.filter(Article.section_id == section_obj.id)

    articles = query.order_by(Article.published_at.desc().nullslast()).all()
    return articles


@router.get("/all", response_model=list[ArticleOut])
def list_all_articles(
    db: Session = Depends(get_db),
    _: object = Depends(require_role(["moderator", "admin"])),
) -> list[ArticleOut]:
    articles = db.query(Article).order_by(Article.created_at.desc()).all()
    return articles


@router.get("/{slug}", response_model=ArticleOut)
def get_article(
    slug: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
) -> ArticleOut:
    article = db.query(Article).filter(Article.slug == slug).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    if article.status != "published":
        if not current_user or current_user.role not in ["moderator", "admin"]:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    return article


@router.post("", response_model=ArticleOut, status_code=status.HTTP_201_CREATED)
def create_article(
    payload: ArticleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(["moderator", "admin"])),
) -> ArticleOut:
    section = db.query(Section).filter(Section.id == payload.section_id).first()
    if not section:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid section")

    existing = db.query(Article).filter(Article.slug == payload.slug).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug already exists")

    article = Article(
        section_id=payload.section_id,
        slug=payload.slug,
        title=payload.title,
        content=payload.content,
        status=payload.status,
        author_id=current_user.id,
    )
    if payload.status == "published":
        article.published_at = datetime.now(timezone.utc)

    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.patch("/{article_id}", response_model=ArticleOut)
def update_article(
    article_id: str,
    payload: ArticleUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(require_role(["moderator", "admin"])),
) -> ArticleOut:
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    if payload.section_id:
        section = db.query(Section).filter(Section.id == payload.section_id).first()
        if not section:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid section")
        article.section_id = payload.section_id

    if payload.slug:
        existing = db.query(Article).filter(Article.slug == payload.slug, Article.id != article.id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slug already exists")
        article.slug = payload.slug

    if payload.title:
        article.title = payload.title

    if payload.content:
        article.content = payload.content

    if payload.status:
        article.status = payload.status
        if payload.status == "published" and not article.published_at:
            article.published_at = datetime.now(timezone.utc)

    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.post("/{article_id}/publish", response_model=ArticleOut)
def publish_article(
    article_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_role(["moderator", "admin"])),
) -> ArticleOut:
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    article.status = "published"
    article.published_at = datetime.now(timezone.utc)

    db.add(article)
    db.commit()
    db.refresh(article)
    return article
