# Developer Documentation (Dev Guide) — BDM Knowledge Base

## 0) Краткое описание системы

Система — веб-приложение «База знаний Black Desert Mobile».

- Frontend: Next.js (TypeScript)
- Backend: FastAPI (Python)
- База данных: MariaDB
- Очереди/кэш: Redis
- Фоновые задачи: Celery
- Telegram подтверждение: aiogram-бот
- Reverse proxy / TLS / rate-limit: Nginx (на отдельной машине)

## 1) Архитектура и сетевое взаимодействие

### 1.1 Схема

```
Internet
  |
  v
Nginx Reverse Proxy (192.168.20.3)  -  bd-bdm.myrkey.ru : 80/443
  |
  +--> Next.js (192.168.20.4:3000)
  |
  +--> FastAPI (192.168.20.4:8000)
                |
                +--> MariaDB (192.168.20.6:3306)
                |
                +--> Redis (на 192.168.20.4 или отдельный хост)
                |
                +--> Celery worker (на 192.168.20.4)
                |
                +--> aiogram bot (на 192.168.20.4)
```

### 1.2 Правила доступа (обязательно)

- На 192.168.20.4 порты 3000 и 8000 доступны только с 192.168.20.3.
- На 192.168.20.6:3306 доступ только с 192.168.20.4.
- Redis не должен быть открыт наружу (желательно только localhost / внутренние сервисы).

## 2) Репозиторий и структура проекта

### 2.1 Рекомендуемая структура mono-repo

```
bdm-knowledge/
  frontend/                  # Next.js
  backend/                   # FastAPI + Celery
  bot/                       # aiogram bot
  infra/
    nginx/                   # конфиги reverse proxy (пример)
    systemd/                 # unit-файлы
  docs/
    DEV_GUIDE.md             # этот документ
    API.md                   # контракт API
    DB.md                    # схема БД
  .editorconfig
  README.md
```

Если у тебя будут отдельные репозитории — структура сохраняется логически.

## 3) Стандарты разработки

### 3.1 Общие требования

- Все конфиги через ENV переменные.
- Secrets не коммитить.
- Строгая типизация (TS + Pydantic).
- Миграции только через Alembic.
- Любая проверка прав доступа — на backend (frontend только UI).

### 3.2 Code style

Frontend

- ESLint + Prettier.
- TypeScript strict.
- Импорт по alias (@/…).

Backend

- ruff + black.
- mypy (желательно).
- pytest для тестов.

## 4) Переменные окружения

### 4.1 Backend env (/etc/bdm/bdm.env или .env)

Минимум:

```
APP_ENV=production
LOG_LEVEL=INFO
BASE_URL=https://bd-bdm.myrkey.ru

DB_HOST=192.168.20.6
DB_PORT=3306
DB_NAME=bdm_kb
DB_USER=bdm_app
DB_PASSWORD=CHANGE_ME

REDIS_URL=redis://127.0.0.1:6379/0

JWT_SECRET=CHANGE_ME
JWT_ACCESS_TTL_MIN=15
JWT_REFRESH_TTL_DAYS=30

TELEGRAM_BOT_TOKEN=CHANGE_ME
TELEGRAM_CONFIRM_TOKEN=CHANGE_ME_LONG_TOKEN

# Для подтверждения регистрации
TG_CONFIRM_CODE_TTL_MIN=10
TG_CONFIRM_MAX_ATTEMPTS=5

# Rate limit (включён по умолчанию)
RATE_LIMIT_ENABLED=1
RATE_LIMIT_WINDOW_SEC=60
RATE_LIMIT_LOGIN_MAX=10
RATE_LIMIT_REGISTER_MAX=5
RATE_LIMIT_CONFIRM_MAX=10

# Включение web-installer (временно)
INSTALLER_ENABLED=0
INSTALLER_TOKEN=CHANGE_ME_INSTALL_TOKEN

# Медиа (обновления/изображения)
MEDIA_DIR=/opt/bdm-knowledge/uploads
MEDIA_URL=/api/media
MEDIA_MAX_MB=10
IFRAME_ALLOWED_HOSTS=youtube.com,youtu.be,youtube-nocookie.com,vk.com,vk.ru,player.vk.com

# Dev CORS example: http://localhost:3000
CORS_ALLOW_ORIGINS=

# Bot uses this when sharing the env file
BACKEND_BASE_URL=http://127.0.0.1:8000
```

### 4.2 Frontend env

`frontend/.env.production`:

```
NEXT_PUBLIC_API_BASE=/api
API_INTERNAL_URL=http://127.0.0.1:8000
NEXT_PUBLIC_TELEGRAM_BOT_URL=https://t.me/YourBot
```

Для dev-режима добавь прокси:
```
API_PROXY_URL=http://127.0.0.1:8000
```

Важно: `NEXT_PUBLIC_*` читаются только во время `npm run build`.

## 5) Backend (FastAPI) — требования и запуск

### 5.1 Технологии

- FastAPI
- SQLAlchemy 2.0
- Alembic
- PyMySQL (sync) — рекомендовано для MVP (минимум «магии»)
- Pydantic

### 5.2 Подключение к MariaDB (пример DSN)

Пример для SQLAlchemy (sync):

```
mysql+pymysql://USER:PASSWORD@192.168.20.6:3306/bdm_kb?charset=utf8mb4
```

### 5.3 Запуск в dev

Из каталога `backend/`:

```
export APP_ENV=development
export JWT_SECRET=dev_change_me_please
export TELEGRAM_CONFIRM_TOKEN=dev_change_me_please
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5.4 Запуск в production

Только через gunicorn:

```
gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --workers 2 \
  --access-logfile - \
  --error-logfile -
```

В проде конфигурация берётся из `/etc/bdm/bdm.env` через systemd `EnvironmentFile`.
`.env` используется только для локальной разработки.

## 6) Миграции БД (Alembic)

### 6.1 Правила

- Любое изменение моделей → миграция.
- Миграции именовать осмысленно: add_article_status, create_comments_table и т.д.

### 6.2 Команды

```
alembic revision -m "create articles table" --autogenerate
alembic upgrade head
alembic downgrade -1
```

## 6.3 Release checklist (кратко)

- Секреты и ENV настроены: `JWT_SECRET`, `DB_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CONFIRM_TOKEN`, `INSTALLER_TOKEN`.
- Инсталлер отключён: `INSTALLER_ENABLED=0`, маршрут `/install` скрыт.
- Бэкап БД и `uploads/` сделан.
- CI зелёный (tests/lint/audit).
- Миграции применены: `alembic upgrade head`.
- Сервисы перезапущены и `GET /api/health` отвечает.

## 7) Модель данных (минимальная, MVP)

### 7.1 users

- id (UUID/char(36))
- username (unique, формат @name)
- password_hash
- role (user|moderator|admin)
- telegram_id (nullable, unique)
- is_active
- created_at

### 7.2 sections

- id
- slug (unique)
- title
- description
- sort_order
- is_visible

### 7.3 articles

- id
- section_id (FK)
- slug (unique)
- title
- content (LONGTEXT, markdown)
- status (draft|published|archived)
- author_id (FK users)
- created_at / updated_at / published_at

### 7.4 comments

- id
- article_id (FK)
- author_id (FK)
- parent_id (nullable)
- content (TEXT)
- is_hidden
- created_at / updated_at

### 7.5 registration_requests (или telegram_verifications)

- id
- username
- password_hash (или временное хранение до подтверждения)
- telegram_id (nullable на старте)
- code_hash
- expires_at
- attempts
- status (pending|approved|expired|rejected)
- created_at

## 8) Авторизация и безопасность

### 8.1 Подход

- JWT access/refresh.
- хранение в HttpOnly cookies.
- backend выставляет cookies; frontend работает same-origin через /api.

### 8.2 RBAC

- Декоратор/Dependency вида require_role(["moderator","admin"]).
- Проверка прав всегда в API.

### 8.3 Rate limit

- На reverse proxy: /api/auth/ ограничить limit_req.
- На backend: дополнительный throttling (по IP/username через Redis) — желательно, но можно позже.

## 9) Регистрация через Telegram — правильный flow

### 9.1 Требование безопасности

Пароль не отправлять в Telegram. Telegram используется для подтверждения владения аккаунтом.

### 9.2 Сценарий (рекомендуемый)

Пользователь на сайте вводит @username + password.

Backend:

- создаёт registration_request
- генерирует одноразовый код (например 6–8 символов), хранит code_hash

Сайт показывает: «Откройте бота и отправьте код».

Пользователь пишет боту /start, затем отправляет код.

Бот вызывает backend endpoint подтверждения (service-to-service):

- проверка TTL, attempts
- создание пользователя
- registration_request.status=approved

Альтернатива: deep-link вида t.me/YourBot?start=<token> — также корректно.

## 10) Celery и фоновые задачи

### 10.1 Использование Celery

- отправка Telegram сообщений/кодов
- очистка просроченных заявок
- уведомления (на будущее)

### 10.2 Redis

- broker/result backend (минимально)
- ключи throttling (если добавите)

### 10.3 Запуск worker

```
celery -A app.celery_app worker --loglevel=INFO --concurrency=2
```

## 11) Telegram bot (aiogram)

### 11.1 Принципы

- bot НЕ ходит напрямую в БД.
- bot общается с backend по HTTP (внутренняя сеть).
- bot не хранит секреты кроме BOT_TOKEN.

### 11.2 Обязательные команды MVP

- /start
- обработка «код подтверждения»
- ответ «успешно/ошибка/код истёк/превышены попытки»

## 12) Frontend (Next.js)

### 12.1 Принципы

- API вызывается по /api/... (same-origin).
- auth cookies автоматически прикладываются браузером.
- страницы:
  - public: разделы/статьи
  - protected: профиль
  - moderator: панель управления

### 12.2 UI

- Tailwind + shadcn/ui
- формы: react-hook-form + zod
- контент статьи: Markdown renderer (MVP) или TipTap/Editor.js (позже)

Для смены API base URL без пересборки используйте прокси на уровне Nginx
(`location /api/` → backend) и `NEXT_PUBLIC_API_BASE=/api`.

## 13) Nginx reverse proxy (192.168.20.3)

### 13.1 Роутинг

- /api/ → 192.168.20.4:8000
- / → 192.168.20.4:3000

### 13.2 TLS

- Let’s Encrypt
- TLSv1.2/1.3
- HSTS включать только после проверки стабильности HTTPS

### 13.3 Rate limit

- ограничение на /api/auth/

## 14) systemd (на 192.168.20.4)

Три сервиса:

- bdm-api.service (gunicorn)
- bdm-celery.service (celery worker)
- bdm-bot.service (aiogram bot)

Юниты должны:

- использовать отдельного пользователя bdm
- подхватывать /etc/bdm/bdm.env
- рестартиться при падении

(Если нужно — можешь использовать те unit-файлы, которые я давал ранее.)

## 15) Логирование и диагностика

### 15.1 Где смотреть

- journalctl -u bdm-api -f
- journalctl -u bdm-celery -f
- journalctl -u bdm-bot -f
- Nginx: /var/log/nginx/access.log, /var/log/nginx/error.log

### 15.2 Формат логов

- backend: структурные логи (минимум request_id, user_id, ip)
- ошибки: stacktrace в stderr (journal)

## 16) Тестирование

### 16.1 Backend

- pytest
- минимум:
  - auth: register/login/refresh
  - RBAC: moderator endpoints
  - telegram confirm: code TTL / attempts

### 16.2 Frontend

- минимально: проверка страниц и форм (можно позже)
- e2e (опционально): Playwright на auth/публикацию

### 16.3 Security checks

- `scripts/security_audit.sh` (нужен `pip-audit` в PATH)

## 17) Процесс разработки (workflow)

### 17.1 Ветки

- main — стабильная
- dev — интеграционная
- feature/* — фичи
- fix/* — баги

### 17.2 Правило релизов

Перед релизом: миграции, smoke-тест /health, проверка auth.

## 18) Минимальные endpoints (контракт MVP)

Auth

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- GET /api/auth/me

Telegram

- POST /api/telegram/confirm (internal)

Sections

- GET /api/sections
- GET /api/sections/all (moderator)
- POST /api/sections (moderator)

Articles

- GET /api/articles?section=...
- GET /api/articles/all (moderator)
- GET /api/articles/{slug}
- POST /api/articles (moderator)
- PATCH /api/articles/{id} (moderator)
- POST /api/articles/{id}/publish (moderator)

Comments

- GET /api/articles/{id}/comments
- POST /api/articles/{id}/comments (user+)
- PATCH /api/comments/{id}/hide (moderator)

Updates

- GET /api/updates
- GET /api/updates/{id}
- GET /api/updates/admin/list (moderator)
- POST /api/updates (moderator)
- PATCH /api/updates/{id} (moderator)
- POST /api/updates/{id}/publish (moderator)
- POST /api/updates/{id}/unpublish (moderator)
- POST /api/updates/media (moderator)
- GET /api/updates/{id}/audit (moderator)
- DELETE /api/updates/{id} (moderator)

Installer (если включён)

- GET /api/install/status
- POST /api/install/checks
- POST /api/install/hosts-check
- POST /api/install/migrate
- POST /api/install/admin
- POST /api/install/seed
- POST /api/install/finish
- POST /api/install/one-click
- POST /api/install/full

## 19) Требования к готовности MVP (Acceptance Criteria)

MVP считается готовым, если:

- Регистрация работает с подтверждением через Telegram (код/токен, TTL, лимит попыток).
- Вход/выход/refresh работают через HttpOnly cookies.
- RBAC реализован: user не может создавать статьи, moderator может.
- Публичные статьи доступны гостям.
- Комментарии доступны авторизованным.
- Сервисы под systemd стабильны (рестарт, логи).
- Reverse proxy корректно маршрутизирует / и /api.

## 20) Обязательные «технические» endpoints

- GET /api/health → {"status":"ok"} (для мониторинга и проверки reverse proxy)
