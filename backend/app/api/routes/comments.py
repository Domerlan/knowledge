from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_user_optional, get_db, require_role
from app.models.article import Article
from app.models.comment import Comment
from app.schemas.comments import CommentCreate, CommentOut
from app.services.sanitize import sanitize_html

router = APIRouter(tags=["comments"])


@router.get("/articles/{article_id}/comments", response_model=list[CommentOut])
def list_comments(
    article_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
) -> list[CommentOut]:
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    if article.status != "published":
        if not current_user or current_user.role not in ["moderator", "admin"]:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    query = db.query(Comment).filter(Comment.article_id == article_id)
    if not current_user or current_user.role not in ["moderator", "admin"]:
        query = query.filter(Comment.is_hidden.is_(False))

    return query.order_by(Comment.created_at.asc()).all()


@router.post(
    "/articles/{article_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    article_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> CommentOut:
    article = (
        db.query(Article).filter(Article.id == article_id, Article.status == "published").first()
    )
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    comment = Comment(
        article_id=article_id,
        author_id=current_user.id,
        parent_id=payload.parent_id,
        content=sanitize_html(payload.content),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.patch("/comments/{comment_id}/hide", response_model=CommentOut)
def hide_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_role(["moderator", "admin"])),
) -> CommentOut:
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    comment.is_hidden = True
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
