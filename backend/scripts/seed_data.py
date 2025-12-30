from __future__ import annotations

import argparse
import sys

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User
from app.services.seed import seed_articles as seed_articles_service
from app.services.seed import seed_sections as seed_sections_service


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed initial sections and articles.")
    parser.add_argument("--author", default="@admin", help="Author username to attach articles")
    parser.add_argument("--password", default=None, help="Create author if missing (password)")
    parser.add_argument("--role", default="admin", choices=["user", "moderator", "admin"])
    parser.add_argument("--upsert", action="store_true", help="Update existing records")
    return parser.parse_args()


def ensure_author(db, username: str, password: str | None, role: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if user:
        return user

    if not password:
        print("Author not found. Provide --password to create.", file=sys.stderr)
        sys.exit(1)

    user = User(
        username=username,
        password_hash=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def main() -> None:
    args = parse_args()
    db = SessionLocal()
    try:
        author = ensure_author(db, args.author, args.password, args.role)
        sections = seed_sections_service(db, upsert=args.upsert)
        seed_articles_service(db, author, sections, upsert=args.upsert)
        print("Seed completed")
    finally:
        db.close()


if __name__ == "__main__":
    main()
