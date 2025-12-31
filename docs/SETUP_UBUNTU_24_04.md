# Запуск проекта на Ubuntu Server 24.04 (подробная инструкция)

Ниже инструкция для «голой» Ubuntu 24.04. Я разделил по ролям хостов,
но если всё разворачивать на одной машине — просто следуй всем разделам.

## 0) Термины и роли

- App host (192.168.20.4): backend + celery + bot + frontend.
- DB host (192.168.20.6): MariaDB.
- Reverse proxy (192.168.20.3): Nginx + TLS.

## 1) Подготовка системы (App host)

### 1.1 Обновление и базовые пакеты

```bash
sudo apt update
sudo apt install -y curl git build-essential python3 python3-venv python3-dev
```

### 1.2 Node.js (для Next.js)

Рекомендую Node.js 20 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Проверка:
```bash
node -v
npm -v
```

### 1.3 Redis (на app host)

```bash
sudo apt install -y redis-server
```

Проверь, что Redis слушает только localhost:
```bash
sudo ss -lntp | grep 6379
```
Если Redis слушает 0.0.0.0, исправь в `/etc/redis/redis.conf`:
```
bind 127.0.0.1 ::1
```

### 1.4 Пользователь и директории

```bash
sudo useradd -m -s /bin/bash bdm
sudo mkdir -p /etc/bdm
sudo mkdir -p /opt/bdm-knowledge/uploads
sudo chown -R bdm:bdm /opt/bdm-knowledge
```

## 1.5 Упрощенные варианты установки

### Вариант A: один сервер, без Nginx и systemd (минимум шагов)

Подходит для быстрого теста или локального стенда.

1) Подготовь Python/Node/Redis (разделы 1.1–1.3).  
2) Пропусти Nginx и systemd.  
3) Запусти сервисы вручную (см. раздел 9).

### Вариант B: MariaDB уже установлена (как у тебя)

Нужно только создать пользователя/базу и выполнить миграции:

1) Раздел 2.2 (CREATE DATABASE/USER).  
2) Раздел 3.2 (env-файл).  
3) Раздел 3.3 (alembic upgrade head).  

### Вариант C: одна машина для всего (app + db)

Можно держать MariaDB и Redis на том же хосте.  
Важно ограничить доступ (bind-address + firewall), чтобы БД и Redis не были публичными.

### Вариант D: локальный dev без MariaDB (SQLite)

Подходит только для разработки:

1) В `/etc/bdm/bdm.env` добавь: `DATABASE_URL=sqlite:///./dev.db`  
2) Запусти `alembic upgrade head` — таблицы создадутся в локальном файле.  
3) Не использовать в продакшене.

## 2) MariaDB (DB host)

### 2.1 Установка

```bash
sudo apt update
sudo apt install -y mariadb-server
```

### 2.2 База и пользователь

```bash
sudo mysql
```

Выполни в консоли MariaDB:
```sql
CREATE DATABASE bdm_kb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bdm_app'@'192.168.20.4' IDENTIFIED BY 'CHANGE_ME';
GRANT ALL PRIVILEGES ON bdm_kb.* TO 'bdm_app'@'192.168.20.4';
FLUSH PRIVILEGES;
```

### 2.3 Сетевой доступ

Разреши доступ только с 192.168.20.4:
- В `/etc/mysql/mariadb.conf.d/50-server.cnf` выставь `bind-address = 192.168.20.6`.
- Открой порт 3306 только для 192.168.20.4 (firewall).

## 3) Backend (App host)

### 3.1 Виртуальное окружение

```bash
cd /opt/bdm-knowledge/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3.2 ENV-файл

Создай `/etc/bdm/bdm.env`:
```bash
sudo nano /etc/bdm/bdm.env
```

Пример:
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

TG_CONFIRM_CODE_TTL_MIN=10
TG_CONFIRM_MAX_ATTEMPTS=5

# Rate limit (enabled by default)
RATE_LIMIT_ENABLED=1
RATE_LIMIT_WINDOW_SEC=60
RATE_LIMIT_LOGIN_MAX=10
RATE_LIMIT_REGISTER_MAX=5
RATE_LIMIT_CONFIRM_MAX=10

# Временное включение web-installer
INSTALLER_ENABLED=1
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

После завершения установки обязательно отключи инсталлер:
```
INSTALLER_ENABLED=0
```

### 3.3 Миграции

```bash
source /opt/bdm-knowledge/backend/.venv/bin/activate
cd /opt/bdm-knowledge/backend
alembic upgrade head
```

### 3.4 Создание администратора

```bash
source /opt/bdm-knowledge/backend/.venv/bin/activate
cd /opt/bdm-knowledge/backend
python scripts/create_user.py --username @admin --password CHANGE_ME --role admin
```

### 3.5 Seed-данные (опционально)

Добавляет базовые разделы и статьи:

```bash
source /opt/bdm-knowledge/backend/.venv/bin/activate
cd /opt/bdm-knowledge/backend
python scripts/seed_data.py --author @admin --password CHANGE_ME --upsert
```

### 3.6 Web-installer (удалённо)

Если нужен удалённый мастер установки:

0) Если хочешь, чтобы системные шаги выполнялись прямо из веб-мастера, один раз запусти:
```bash
sudo /opt/bdm-knowledge/scripts/enable_web_installer.sh
```
1) Включи `INSTALLER_ENABLED=1` и задай `INSTALLER_TOKEN`.  
2) Убедись, что backend и frontend запущены.  
3) Открой в браузере: `https://bd-bdm.myrkey.ru/install`  
4) Пройди шаги мастера:
   - Шаг 1: язык интерфейса.
   - Шаг 2: bootstrap (команда для системной установки).
   - Шаг 3: ввод токена.
   - Шаг 4: конфигурация и сохранение env файлов в `/etc/bdm/`.
   - Шаг 5: проверка доступности БД/Redis + системная установка (опционально).
   - Шаг 6: установка приложения (миграции, админ, сид, отключение установщика).
   - Шаг 7: статус администратора.
   - Шаг 8: завершение.
5) Установщик сам выставляет `INSTALLER_ENABLED=0` при успешном завершении.  
6) Перезапусти API, чтобы применить изменения:
```bash
systemctl restart bdm-api
```

Повторная проверка мастера:
- Поставь `INSTALLER_ENABLED=1` и перезапусти API.
- Сбрось состояние в браузере (DevTools → Console):
```
localStorage.removeItem("bdmInstallerState")
```
- Открой `/install` снова.

Чтобы полностью скрыть маршрут `/install` после завершения:
```bash
mv /opt/bdm-knowledge/frontend/src/app/install /opt/bdm-knowledge/frontend/src/app/_install.disabled
cd /opt/bdm-knowledge/frontend && npm run build
systemctl restart bdm-frontend
```

Важно: системные шаги требуют root прав. Скрипт `enable_web_installer.sh` добавляет
только одно право sudo без пароля — запуск `scripts/system_install.sh`.

### 3.7 Bootstrap (одна команда, опционально)

Если хочешь ускорить подготовку без web-инсталлера:

```bash
ENV_FILE=/etc/bdm/bdm.env ADMIN_PASSWORD=CHANGE_ME /opt/bdm-knowledge/scripts/bootstrap.sh
```

### 3.8 Full install (скрипт, с systemd)

Все шаги в одной команде (устанавливает пакеты, systemd, миграции, админ, seed):

```bash
sudo ENV_FILE=/etc/bdm/bdm.env FRONTEND_ENV_FILE=/etc/bdm/frontend.env \\
  ADMIN_PASSWORD=CHANGE_ME /opt/bdm-knowledge/scripts/full_install.sh
```

Если нужно сгенерировать env файлы автоматически:

```bash
sudo GENERATE_ENV=1 GENERATE_FRONTEND_ENV=1 \\
  BASE_URL=https://bd-bdm.myrkey.ru \\
  DB_HOST=192.168.20.6 DB_NAME=bdm_kb DB_USER=bdm_app DB_PASSWORD=CHANGE_ME \\
  JWT_SECRET=CHANGE_ME TELEGRAM_BOT_TOKEN=CHANGE_ME \\
  ADMIN_PASSWORD=CHANGE_ME /opt/bdm-knowledge/scripts/full_install.sh
```

## 4) Telegram bot (App host)

```bash
cd /opt/bdm-knowledge/bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Bot читает `TELEGRAM_BOT_TOKEN` и `BACKEND_BASE_URL` из `.env`.
Можно использовать общий `/etc/bdm/bdm.env`, добавив туда:
```
BACKEND_BASE_URL=http://127.0.0.1:8000
```

## 5) Frontend (App host)

### 5.1 Установка зависимостей

```bash
cd /opt/bdm-knowledge/frontend
npm ci
```

### 5.2 ENV для Next.js

Для продакшна можно использовать отдельный файл `/etc/bdm/frontend.env`:
```
NEXT_PUBLIC_API_BASE=/api
API_INTERNAL_URL=http://127.0.0.1:8000
NEXT_PUBLIC_TELEGRAM_BOT_URL=https://t.me/YourBot
```

В dev-режиме (localhost:3000) обязательно прокси:
```
API_PROXY_URL=http://127.0.0.1:8000
```

### 5.3 Build

```bash
cd /opt/bdm-knowledge/frontend
npm run build
```

Важно: переменные `NEXT_PUBLIC_*` берутся во время build.  
Если используешь `/etc/bdm/frontend.env`, запускай так:
```bash
sudo -u bdm bash -lc 'set -a; source /etc/bdm/frontend.env; set +a; cd /opt/bdm-knowledge/frontend && npm run build'
```

### 5.4 Портал (WebM/MP4, опционально)

1) Положи видео в `frontend/public/`:
```
portal.webm
portal.mp4
```
2) Вставь видео в `frontend/src/app/page.tsx` вместо `.home-portal-slot`.
3) Добавь стиль (пример):
```css
.home-portal-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  mix-blend-mode: screen;
  pointer-events: none;
}
```

## 6) systemd (App host)

Скопируй юниты из `infra/systemd/`:

```bash
sudo cp /opt/bdm-knowledge/infra/systemd/bdm-api.service /etc/systemd/system/
sudo cp /opt/bdm-knowledge/infra/systemd/bdm-celery.service /etc/systemd/system/
sudo cp /opt/bdm-knowledge/infra/systemd/bdm-celery-beat.service /etc/systemd/system/
sudo cp /opt/bdm-knowledge/infra/systemd/bdm-bot.service /etc/systemd/system/
sudo cp /opt/bdm-knowledge/infra/systemd/bdm-frontend.service /etc/systemd/system/
```

Перечитать конфиги и включить сервисы:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bdm-api
sudo systemctl enable --now bdm-celery
sudo systemctl enable --now bdm-celery-beat
sudo systemctl enable --now bdm-bot
sudo systemctl enable --now bdm-frontend
```

Логи:
```bash
journalctl -u bdm-api -f
journalctl -u bdm-celery -f
journalctl -u bdm-celery-beat -f
journalctl -u bdm-bot -f
journalctl -u bdm-frontend -f
```

## 7) Nginx reverse proxy (192.168.20.3)

Скопируй `infra/nginx/bdm.conf` в `/etc/nginx/sites-available/` и включи:

```bash
sudo ln -s /etc/nginx/sites-available/bdm.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

TLS сертификат через certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bd-bdm.myrkey.ru
```

## 8) Проверка

На app host:
```bash
curl http://127.0.0.1:8000/api/health
```

Снаружи:
```
https://bd-bdm.myrkey.ru
```

## 9) DEV запуск (локально, одной машиной)

### Backend
```bash
cd /opt/bdm-knowledge/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Bot
```bash
cd /opt/bdm-knowledge/bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
BACKEND_BASE_URL=http://127.0.0.1:8000 python bot.py
```

### Frontend
```bash
cd /opt/bdm-knowledge/frontend
npm ci
API_PROXY_URL=http://127.0.0.1:8000 npm run dev
```

## 10) Firewall (рекомендации)

- App host: порты 3000/8000 доступны только с 192.168.20.3.
- DB host: 3306 доступен только с 192.168.20.4.
- Redis: только localhost.

Если используешь UFW:
```bash
# App host
sudo ufw allow from 192.168.20.3 to any port 8000
sudo ufw allow from 192.168.20.3 to any port 3000

# DB host
sudo ufw allow from 192.168.20.4 to any port 3306
```
