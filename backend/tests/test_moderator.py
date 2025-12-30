from fastapi import status

from app.core.security import hash_password
from app.models.article import Article
from app.models.section import Section
from app.models.user import User


def create_moderator(db_session):
    moderator = User(
        username="@moderator",
        password_hash=hash_password("Password123"),
        role="moderator",
        is_active=True,
    )
    db_session.add(moderator)
    db_session.commit()
    return moderator


def login(client, username: str, password: str) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == status.HTTP_200_OK


def test_sections_all_requires_auth(client):
    response = client.get("/api/sections/all")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_articles_all_for_moderator(client, db_session):
    moderator = create_moderator(db_session)

    section = Section(slug="general", title="General", sort_order=1, is_visible=True)
    db_session.add(section)
    db_session.commit()
    db_session.refresh(section)

    article = Article(
        section_id=section.id,
        slug="draft-article",
        title="Draft",
        content="Draft content",
        status="draft",
        author_id=moderator.id,
    )
    db_session.add(article)
    db_session.commit()

    login(client, "@moderator", "Password123")

    response = client.get("/api/articles/all")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert any(item["slug"] == "draft-article" for item in data)
