from __future__ import annotations

from datetime import datetime, timezone

from app.models.article import Article
from app.models.section import Section
from app.models.user import User

SECTIONS = [
    {
        "slug": "getting-started",
        "title": "Getting Started",
        "description": "Account setup, basic controls, and early game goals.",
        "sort_order": 1,
    },
    {
        "slug": "classes",
        "title": "Classes",
        "description": "Playstyles, strengths, and skill rotation tips.",
        "sort_order": 2,
    },
    {
        "slug": "progression",
        "title": "Progression",
        "description": "Gear enhancement, silver farming, and daily routines.",
        "sort_order": 3,
    },
]

ARTICLES = [
    {
        "slug": "first-steps",
        "title": "First Steps in BDM",
        "section_slug": "getting-started",
        "status": "published",
        "content": """# First Steps in BDM\n\nWelcome to Black Desert Mobile!\n\n## Focus on the Basics\n- Follow the main quest line to unlock core systems.\n- Equip the best gear you get and enhance it to +5 early.\n- Join a guild for passive buffs and community help.\n\n## Daily Routine\n- Complete daily missions and black spirit tasks.\n- Use stamina on gathering or combat zones for materials.\n\nGood luck, adventurer!\n""",
    },
    {
        "slug": "class-pick",
        "title": "Choosing Your Class",
        "section_slug": "classes",
        "status": "draft",
        "content": """# Choosing Your Class\n\nPick a class that matches your preferred playstyle:\n\n- **Melee bruiser**: front-line tankiness and control.\n- **Ranged DPS**: safe damage and kiting tools.\n- **Support**: buffs, debuffs, and party utility.\n\nExperiment and stick with what feels fun.\n""",
    },
]


def seed_sections(db, upsert: bool) -> dict[str, Section]:
    result: dict[str, Section] = {}
    for payload in SECTIONS:
        section = db.query(Section).filter(Section.slug == payload["slug"]).first()
        if section:
            if upsert:
                section.title = payload["title"]
                section.description = payload["description"]
                section.sort_order = payload["sort_order"]
                db.add(section)
            result[section.slug] = section
            continue

        section = Section(
            slug=payload["slug"],
            title=payload["title"],
            description=payload["description"],
            sort_order=payload["sort_order"],
            is_visible=True,
        )
        db.add(section)
        db.flush()
        result[section.slug] = section

    db.commit()
    return result


def seed_articles(db, author: User, sections: dict[str, Section], upsert: bool) -> None:
    for payload in ARTICLES:
        section = sections.get(payload["section_slug"])
        if not section:
            continue

        article = db.query(Article).filter(Article.slug == payload["slug"]).first()
        if article:
            if upsert:
                article.title = payload["title"]
                article.content = payload["content"]
                article.status = payload["status"]
                if payload["status"] == "published" and not article.published_at:
                    article.published_at = datetime.now(timezone.utc)
                db.add(article)
            continue

        article = Article(
            section_id=section.id,
            slug=payload["slug"],
            title=payload["title"],
            content=payload["content"],
            status=payload["status"],
            author_id=author.id,
            published_at=datetime.now(timezone.utc) if payload["status"] == "published" else None,
        )
        db.add(article)

    db.commit()
