#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: scripts/full_install.sh

This script runs full installation with systemd.

Required env:
  ADMIN_PASSWORD       Admin password

Optional env:
  ENV_FILE             Backend env file (default: /etc/bdm/bdm.env)
  FRONTEND_ENV_FILE    Frontend env file (default: /etc/bdm/frontend.env)
  ADMIN_USER           Admin username (default: @admin)
  SEED                 1 to seed data (default: 1)
  UPSERT               1 to upsert seed data (default: 1)
  START_SERVICES       1 to start systemd services (default: 1)

Optional DB provisioning:
  PROVISION_DB         1 to create DB/user (default: 0)
  DB_ROOT_USER         MariaDB root user (default: root)
  DB_ROOT_PASSWORD     MariaDB root password (required if PROVISION_DB=1)
  DB_USER_HOST         Allowed host for app user (default: 192.168.20.4)

Note: ENV_FILE and FRONTEND_ENV_FILE must exist before running.
USAGE
  exit 0
fi

if [[ $EUID -ne 0 ]]; then
  echo "This script must run as root (sudo)." >&2
  exit 1
fi

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE="${ENV_FILE:-/etc/bdm/bdm.env}"
FRONTEND_ENV_FILE="${FRONTEND_ENV_FILE:-/etc/bdm/frontend.env}"
ADMIN_USER="${ADMIN_USER:-@admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
SEED="${SEED:-1}"
UPSERT="${UPSERT:-1}"
START_SERVICES="${START_SERVICES:-1}"
PROVISION_DB="${PROVISION_DB:-0}"
DB_ROOT_USER="${DB_ROOT_USER:-root}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-}"
DB_USER_HOST="${DB_USER_HOST:-192.168.20.4}"
GENERATE_ENV="${GENERATE_ENV:-0}"
GENERATE_FRONTEND_ENV="${GENERATE_FRONTEND_ENV:-0}"
FORCE_ENV="${FORCE_ENV:-0}"

APP_ENV="${APP_ENV:-production}"
BASE_URL="${BASE_URL:-https://bd-bdm.myrkey.ru}"
DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/0}"
JWT_SECRET="${JWT_SECRET:-}"
JWT_ACCESS_TTL_MIN="${JWT_ACCESS_TTL_MIN:-15}"
JWT_REFRESH_TTL_DAYS="${JWT_REFRESH_TTL_DAYS:-30}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TG_CONFIRM_CODE_TTL_MIN="${TG_CONFIRM_CODE_TTL_MIN:-10}"
TG_CONFIRM_MAX_ATTEMPTS="${TG_CONFIRM_MAX_ATTEMPTS:-5}"
BACKEND_BASE_URL="${BACKEND_BASE_URL:-http://127.0.0.1:8000}"
NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE:-/api}"
API_INTERNAL_URL="${API_INTERNAL_URL:-http://127.0.0.1:8000}"
API_PROXY_URL="${API_PROXY_URL:-$API_INTERNAL_URL}"

if [[ -z "$ADMIN_PASSWORD" ]]; then
  echo "ADMIN_PASSWORD is required" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" || "$FORCE_ENV" == "1" ]]; then
  if [[ "$GENERATE_ENV" == "1" ]]; then
    if [[ -z "$DB_HOST" || -z "$DB_NAME" || -z "$DB_USER" || -z "$DB_PASSWORD" || -z "$JWT_SECRET" || -z "$TELEGRAM_BOT_TOKEN" ]]; then
      echo "DB_HOST/DB_NAME/DB_USER/DB_PASSWORD/JWT_SECRET/TELEGRAM_BOT_TOKEN are required to generate ENV_FILE" >&2
      exit 1
    fi
    mkdir -p "$(dirname "$ENV_FILE")"
    cat <<EOF_ENV > "$ENV_FILE"
APP_ENV=$APP_ENV
BASE_URL=$BASE_URL

DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD

REDIS_URL=$REDIS_URL

JWT_SECRET=$JWT_SECRET
JWT_ACCESS_TTL_MIN=$JWT_ACCESS_TTL_MIN
JWT_REFRESH_TTL_DAYS=$JWT_REFRESH_TTL_DAYS

TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN

TG_CONFIRM_CODE_TTL_MIN=$TG_CONFIRM_CODE_TTL_MIN
TG_CONFIRM_MAX_ATTEMPTS=$TG_CONFIRM_MAX_ATTEMPTS

BACKEND_BASE_URL=$BACKEND_BASE_URL

INSTALLER_ENABLED=0
INSTALLER_TOKEN=CHANGE_ME_INSTALL_TOKEN
EOF_ENV
  else
    echo "Missing ENV_FILE: $ENV_FILE" >&2
    exit 1
  fi
fi

if [[ ! -f "$FRONTEND_ENV_FILE" || "$FORCE_ENV" == "1" ]]; then
  if [[ "$GENERATE_FRONTEND_ENV" == "1" ]]; then
    mkdir -p "$(dirname "$FRONTEND_ENV_FILE")"
    cat <<EOF_FRONT > "$FRONTEND_ENV_FILE"
NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
API_INTERNAL_URL=$API_INTERNAL_URL
API_PROXY_URL=$API_PROXY_URL
EOF_FRONT
  else
    echo "Missing FRONTEND_ENV_FILE: $FRONTEND_ENV_FILE" >&2
    exit 1
  fi
fi

set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a

if [[ "$PROVISION_DB" == "1" ]]; then
  if [[ -z "$DB_ROOT_PASSWORD" ]]; then
    echo "DB_ROOT_PASSWORD is required when PROVISION_DB=1" >&2
    exit 1
  fi
  if [[ -z "${DB_HOST:-}" || -z "${DB_PORT:-}" || -z "${DB_NAME:-}" || -z "${DB_USER:-}" || -z "${DB_PASSWORD:-}" ]]; then
    echo "DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD must be set in ENV_FILE" >&2
    exit 1
  fi

  python3 -m venv "$ROOT_DIR/backend/.venv"
  "$ROOT_DIR/backend/.venv/bin/pip" install -r "$ROOT_DIR/backend/requirements.txt"
  PYTHONPATH="$ROOT_DIR/backend" \
    DB_ROOT_USER="$DB_ROOT_USER" \
    DB_ROOT_PASSWORD="$DB_ROOT_PASSWORD" \
    DB_USER_HOST="$DB_USER_HOST" \
    "$ROOT_DIR/backend/.venv/bin/python" - <<'PY'
import os
from app.services.system_setup import provision_database

provision_database(
    host=os.environ["DB_HOST"],
    port=int(os.environ["DB_PORT"]),
    root_user=os.environ["DB_ROOT_USER"],
    root_password=os.environ["DB_ROOT_PASSWORD"],
    db_name=os.environ["DB_NAME"],
    app_user=os.environ["DB_USER"],
    app_password=os.environ["DB_PASSWORD"],
    app_host=os.environ["DB_USER_HOST"],
)
print("DB provisioned")
PY
fi

ENV_FILE="$ENV_FILE" FRONTEND_ENV_FILE="$FRONTEND_ENV_FILE" START_SERVICES="$START_SERVICES" \
  "$ROOT_DIR/scripts/system_install.sh"

ENV_FILE="$ENV_FILE" ADMIN_USER="$ADMIN_USER" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  SEED="$SEED" UPSERT="$UPSERT" "$ROOT_DIR/scripts/bootstrap.sh"

echo "Full install completed"
