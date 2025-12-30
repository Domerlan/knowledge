from fastapi import status

from app.core.security import hash_password
from app.models.user import User


def test_register_confirm_login_refresh(client):
    register = client.post(
        "/api/auth/register",
        json={"username": "@testuser", "password": "Password123"},
    )
    assert register.status_code == status.HTTP_201_CREATED
    code = register.json()["code"]

    confirm = client.post(
        "/api/telegram/confirm",
        json={"code": code, "telegram_id": "123456"},
    )
    assert confirm.status_code == status.HTTP_200_OK
    assert confirm.json()["status"] == "approved"

    login = client.post(
        "/api/auth/login",
        json={"username": "@testuser", "password": "Password123"},
    )
    assert login.status_code == status.HTTP_200_OK
    assert login.json()["user"]["username"] == "@testuser"

    refresh = client.post("/api/auth/refresh")
    assert refresh.status_code == status.HTTP_200_OK

    logout = client.post("/api/auth/logout")
    assert logout.status_code == status.HTTP_200_OK


def test_moderator_create_section(client, db_session):
    moderator = User(
        username="@mod",
        password_hash=hash_password("Password123"),
        role="moderator",
        is_active=True,
    )
    db_session.add(moderator)
    db_session.commit()

    login = client.post(
        "/api/auth/login",
        json={"username": "@mod", "password": "Password123"},
    )
    assert login.status_code == status.HTTP_200_OK

    create = client.post(
        "/api/sections",
        json={
            "title": "General",
            "slug": "general",
            "description": "General info",
            "sort_order": 1,
            "is_visible": True,
        },
    )
    assert create.status_code == status.HTTP_201_CREATED
    assert create.json()["slug"] == "general"
