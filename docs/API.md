# API Contract (MVP)

Base URL: `/api`

Auth uses HttpOnly cookies: `access_token`, `refresh_token`.

## Auth

### POST /api/auth/register
Request:
```json
{
  "username": "@player",
  "password": "Password123"
}
```
Response:
```json
{
  "status": "pending",
  "code": "AB12CD34",
  "expires_at": "2024-12-23T12:00:00Z"
}
```

### POST /api/auth/register/status
Request:
```json
{
  "code": "AB12CD34"
}
```
Response:
```json
{
  "status": "pending"
}
```

### POST /api/auth/login
Request:
```json
{
  "username": "@player",
  "password": "Password123"
}
```
Response:
```json
{
  "user": {
    "id": "uuid",
    "username": "@player",
    "role": "user",
    "telegram_id": null,
    "is_active": true,
    "created_at": "2024-12-23T12:00:00Z"
  }
}
```

### POST /api/auth/refresh
Response: same as `/auth/login`.

### POST /api/auth/logout
Response:
```json
{
  "status": "ok"
}
```

### GET /api/auth/me
Response: `user` object (same shape as login).

## Telegram

### POST /api/telegram/confirm
Request:
```json
{
  "code": "AB12CD34",
  "telegram_id": "123456789",
  "telegram_username": "playername"
}
```
Response:
```json
{
  "status": "approved",
  "message": "Registration confirmed"
}
```

## Sections

### GET /api/sections
Response: list of sections.

### GET /api/sections/all (moderator)
Response: list of all sections (including hidden).

### POST /api/sections (moderator)
Request:
```json
{
  "title": "General",
  "slug": "general",
  "description": "General info",
  "sort_order": 1,
  "is_visible": true
}
```

## Articles

### GET /api/articles?section=general
Response: list of published articles.

### GET /api/articles/all (moderator)
Response: list of all articles (draft/published/archived).

### GET /api/articles/{slug}
Response: article detail.

### POST /api/articles (moderator)
Request:
```json
{
  "section_id": "uuid",
  "slug": "first-steps",
  "title": "First Steps",
  "content": "Markdown...",
  "status": "draft"
}
```

### PATCH /api/articles/{id} (moderator)
Request: any subset of fields.

### POST /api/articles/{id}/publish (moderator)
Response: article detail.

## Comments

### GET /api/articles/{id}/comments
Response: list of comments.

### POST /api/articles/{id}/comments (user+)
Request:
```json
{
  "content": "Nice guide",
  "parent_id": null
}
```

### PATCH /api/comments/{id}/hide (moderator)
Response: comment detail.

## Health

### GET /api/health
Response:
```json
{
  "status": "ok"
}
```

## Updates (public)

### GET /api/updates?page=1&per_page=10
Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Patch 1.2.3",
      "patch_date": "2025-01-01"
    }
  ],
  "total": 1,
  "page": 1,
  "per_page": 10,
  "has_more": false
}
```

### GET /api/updates/{id}
Response:
```json
{
  "id": "uuid",
  "title": "Patch 1.2.3",
  "patch_date": "2025-01-01",
  "content": "<p>HTML...</p>",
  "published_at": "2025-01-01T10:00:00Z"
}
```

## Updates (admin/moderator)

### GET /api/updates/admin/list?status=draft&q=patch&include_deleted=false
Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Patch 1.2.3",
      "patch_date": "2025-01-01",
      "content": "<p>HTML...</p>",
      "status": "draft",
      "created_by_id": "uuid",
      "updated_by_id": null,
      "published_by_id": null,
      "created_at": "2025-01-01T10:00:00Z",
      "updated_at": null,
      "published_at": null,
      "deleted_at": null
    }
  ],
  "total": 1,
  "page": 1,
  "per_page": 10,
  "has_more": false
}
```

### POST /api/updates
Request:
```json
{
  "title": "Patch 1.2.3",
  "patch_date": "2025-01-01",
  "content": "<p>HTML...</p>",
  "status": "draft"
}
```

### PATCH /api/updates/{id}
Request: any subset of fields from create.

### POST /api/updates/{id}/publish
Response:
```json
{
  "status": "published",
  "published_at": "2025-01-01T10:00:00Z"
}
```

### POST /api/updates/{id}/unpublish
Response:
```json
{
  "status": "draft",
  "published_at": null
}
```

### DELETE /api/updates/{id}
Response:
```json
{
  "status": "deleted"
}
```

### POST /api/updates/{id}/restore
Response:
```json
{
  "status": "restored"
}
```

### GET /api/updates/{id}/audit
Response: list of audit entries.

### POST /api/updates/media
Multipart upload, form field: `file`.
Response:
```json
{
  "url": "/api/media/updates/<filename>",
  "filename": "<filename>",
  "size": 12345
}
```

## Installer (remote)

Все запросы требуют заголовок `X-Installer-Token: <token>`.

### GET /api/install/status
Response:
```json
{
  "enabled": true,
  "db_ok": true,
  "installed": false
}
```

### POST /api/install/env
Сохраняет env-файлы на сервере.
Request:
```json
{
  "backend_env": "APP_ENV=production\\nDB_HOST=192.168.20.6\\n...",
  "frontend_env": "NEXT_PUBLIC_API_BASE=/api\\n..."
}
```
Response:
```json
{
  "status": "ok"
}
```

### POST /api/install/db-check
Проверяет доступ к базе по переданному `backend_env`.
Request:
```json
{
  "backend_env": "DB_HOST=192.168.20.6\\nDB_USER=bdm_app\\nDB_PASSWORD=...\\n"
}
```
Response:
```json
{
  "db_ok": true,
  "error": null
}
```

### GET /api/install/bootstrap-status
Проверяет, подготовлен ли сервер для системных шагов. Токен не требуется.
Response:
```json
{
  "env_dir_exists": true,
  "env_dir_writable": true,
  "sudoers_present": true,
  "system_install_exists": true
}
```

### POST /api/install/hosts-check
Request:
```json
{
  "items": [
    { "name": "db", "host": "192.168.20.6", "port": 3306 }
  ]
}
```
Response:
```json
{
  "results": [
    { "name": "db", "host": "192.168.20.6", "port": 3306, "ok": true }
  ]
}
```

### POST /api/install/system-setup
Запускает системную установку (Node/Redis/systemd/build). Требует sudo без пароля.
Request:
```json
{
  "install_node": true,
  "install_redis": true,
  "use_nodesource": true,
  "build_frontend": true,
  "setup_systemd": true,
  "start_services": true
}
```
Response:
```json
{
  "status": "ok",
  "output": "..."
}
```

### POST /api/install/migrate
Response:
```json
{
  "status": "ok"
}
```

### POST /api/install/admin
Request:
```json
{
  "username": "@admin",
  "password": "CHANGE_ME",
  "role": "admin"
}
```
Response:
```json
{
  "status": "created"
}
```

### POST /api/install/seed
Request:
```json
{
  "author_username": "@admin",
  "upsert": true
}
```
Response:
```json
{
  "status": "ok"
}
```

### POST /api/install/finish
Response:
```json
{
  "status": "ok"
}
```

### POST /api/install/one-click
Request:
```json
{
  "admin": {
    "username": "@admin",
    "password": "CHANGE_ME",
    "role": "admin"
  },
  "seed": true,
  "seed_upsert": true,
  "finish": true,
  "disable_installer": true,
  "backend_env": "APP_ENV=production\\nDB_HOST=192.168.20.6\\n..."
}
```
Response:
```json
{
  "status": "ok",
  "steps": [
    { "step": "checks", "status": "ok" },
    { "step": "migrate", "status": "ok" },
    { "step": "admin", "status": "created" },
    { "step": "seed", "status": "ok" },
    { "step": "finish", "status": "ok" }
  ]
}
```

### POST /api/install/checks (legacy)
Response:
```json
{
  "db_ok": true,
  "redis_ok": true
}
```

### POST /api/install/full (legacy)
Полная установка за один запрос (используйте только если нужно).
