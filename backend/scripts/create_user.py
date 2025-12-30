from __future__ import annotations

import argparse
import sys

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a user in the BDM Knowledge Base database.")
    parser.add_argument("--username", required=True, help="Username in @name format")
    parser.add_argument("--password", required=True, help="Plain password")
    parser.add_argument("--role", default="admin", choices=["user", "moderator", "admin"])
    parser.add_argument("--telegram-id", default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    username = args.username.strip()
    if not username.startswith("@"):
        print("Username must start with @", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == username).first():
            print("User already exists", file=sys.stderr)
            sys.exit(1)

        if args.telegram_id:
            existing = db.query(User).filter(User.telegram_id == args.telegram_id).first()
            if existing:
                print("Telegram ID already linked", file=sys.stderr)
                sys.exit(1)

        user = User(
            username=username,
            password_hash=hash_password(args.password),
            role=args.role,
            telegram_id=args.telegram_id,
            is_active=True,
        )
        db.add(user)
        db.commit()

        print(f"User created: {user.username} ({user.role})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
