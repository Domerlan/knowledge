#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: scripts/bootstrap.sh

Environment variables:
  ENV_FILE        Path to env file (default: /etc/bdm/bdm.env)
  ADMIN_USER      Admin username (default: @admin)
  ADMIN_PASSWORD  Admin password (required)
  SEED            1 to run seed (default: 1)
  UPSERT          1 to upsert seed data (default: 1)
USAGE
  exit 0
fi

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BACKEND_DIR="$ROOT_DIR/backend"
ENV_FILE="${ENV_FILE:-/etc/bdm/bdm.env}"
ADMIN_USER="${ADMIN_USER:-@admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
SEED="${SEED:-1}"
UPSERT="${UPSERT:-1}"

if [[ -z "$ADMIN_PASSWORD" ]]; then
  echo "ADMIN_PASSWORD is required" >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
fi

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  python3 -m venv "$BACKEND_DIR/.venv"
fi

"$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
"$BACKEND_DIR/.venv/bin/alembic" -c "$BACKEND_DIR/alembic.ini" upgrade head

"$BACKEND_DIR/.venv/bin/python" "$BACKEND_DIR/scripts/create_user.py" \
  --username "$ADMIN_USER" \
  --password "$ADMIN_PASSWORD" \
  --role admin

if [[ "$SEED" == "1" ]]; then
  SEED_ARGS=("--author" "$ADMIN_USER" "--password" "$ADMIN_PASSWORD")
  if [[ "$UPSERT" == "1" ]]; then
    SEED_ARGS+=("--upsert")
  fi
  "$BACKEND_DIR/.venv/bin/python" "$BACKEND_DIR/scripts/seed_data.py" "${SEED_ARGS[@]}"
fi

echo "Bootstrap completed"
