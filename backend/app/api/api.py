from fastapi import APIRouter

from app.api.routes import articles, auth, comments, health, install, sections, telegram, updates

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(telegram.router)
api_router.include_router(sections.router)
api_router.include_router(articles.router)
api_router.include_router(comments.router)
api_router.include_router(updates.router)
api_router.include_router(install.router)
