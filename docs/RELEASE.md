# Release Checklist

This checklist targets production deployments.

## Pre-release
- Verify secrets are set and not default values: `JWT_SECRET`, `DB_PASSWORD`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CONFIRM_TOKEN`, `INSTALLER_TOKEN`.
- Ensure installer is disabled: `INSTALLER_ENABLED=0` and `/install` route is hidden if required.
- Confirm Redis is available; rate limiting fails closed in production when Redis is down.
- Run migrations in a staging environment with a copy of production data if possible.
- Make a database backup and snapshot media storage (`uploads/`).
- Confirm CI is green (tests, lint, audit).

## Deploy
- Pull code to the production host.
- Install backend deps: `pip install -r backend/requirements.txt`.
- Install bot deps: `pip install -r bot/requirements.txt`.
- Install frontend deps with a clean lockfile: `npm ci`.
- Apply DB migrations: `alembic upgrade head`.
- Rebuild frontend with prod env: `npm run build`.
- Restart services: `bdm-api`, `bdm-celery`, `bdm-celery-beat`, `bdm-bot`, `bdm-frontend`.

## Post-release
- Check health endpoint: `GET /api/health`.
- Verify login, registration, and Telegram confirm flow.
- Verify media upload and updates pages.
- Review logs for errors and elevated error rates.

## Rollback
- Keep the previous deployment artifacts and DB backup.
- If migrations are backward-compatible, roll back by deploying previous code.
- If not backward-compatible, restore DB backup and previous code, then restart services.
