# BDM Knowledge Base

Веб-приложение «База знаний Black Desert Mobile».

Документация разработчика: `docs/DEV_GUIDE.md`  
Инструкция запуска на Ubuntu 24.04: `docs/SETUP_UBUNTU_24_04.md`

- Web-installer (удалённо): `https://<domain>/install` (требует `INSTALLER_ENABLED=1` + `INSTALLER_TOKEN`)
- Bootstrap (опционально): `scripts/bootstrap.sh`
- Full install: доступен в web‑installer, требует root/sudo для установки пакетов и systemd
- Full install (script): `scripts/full_install.sh`
- Auto-env: `GENERATE_ENV=1 GENERATE_FRONTEND_ENV=1` for `scripts/full_install.sh`
- Раздел “Обновления игры”: `https://<domain>/updates`
- Админка обновлений: `https://<domain>/moderator/updates` (роль moderator/admin)

После установки можно полностью скрыть маршрут `/install`:
```bash
mv /opt/bdm-knowledge/frontend/src/app/install /opt/bdm-knowledge/frontend/src/app/_install.disabled
cd /opt/bdm-knowledge/frontend && npm run build
systemctl restart bdm-frontend
```

## Портал (WebM/MP4)

Для живого портала используйте видео-оверлей поверх фона.  
Рекомендуемые файлы:

```
frontend/public/portal.webm
frontend/public/portal.mp4
```

Пример вставки в `frontend/src/app/page.tsx` (вместо `.home-portal-slot`):
```tsx
<div className="home-portal-slot" aria-hidden="true">
  <video autoPlay muted loop playsInline className="home-portal-video">
    <source src="/portal.webm" type="video/webm" />
    <source src="/portal.mp4" type="video/mp4" />
  </video>
</div>
```

## Структура

```
bdm-knowledge/
  frontend/                  # Next.js
  backend/                   # FastAPI + Celery
  bot/                       # aiogram bot
  infra/
    nginx/                   # конфиги reverse proxy (пример)
    systemd/                 # unit-файлы
  docs/
    DEV_GUIDE.md             # документация разработчика
    API.md                   # контракт API
    DB.md                    # схема БД
```
