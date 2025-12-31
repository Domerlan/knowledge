#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=${BDM_ROOT:-/opt/bdm-knowledge}
ENV_FILE=${ENV_FILE:-/etc/bdm/bdm.env}
FRONTEND_ENV_FILE=${FRONTEND_ENV_FILE:-/etc/bdm/frontend.env}

INSTALL_NODE=${INSTALL_NODE:-1}
INSTALL_REDIS=${INSTALL_REDIS:-1}
USE_NODESOURCE=${USE_NODESOURCE:-1}
BUILD_FRONTEND=${BUILD_FRONTEND:-1}
SETUP_SYSTEMD=${SETUP_SYSTEMD:-1}
START_SERVICES=${START_SERVICES:-1}

if [[ $EUID -ne 0 ]]; then
  echo "This installer must run as root or via sudo." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt update
apt install -y curl git build-essential python3 python3-venv python3-dev ca-certificates

if [[ "$INSTALL_REDIS" == "1" ]]; then
  apt install -y redis-server
fi

if [[ "$INSTALL_NODE" == "1" ]]; then
  if [[ "$USE_NODESOURCE" == "1" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
  else
    apt install -y nodejs npm
  fi
fi

if ! id -u bdm >/dev/null 2>&1; then
  useradd -m -s /bin/bash bdm
fi

mkdir -p /etc/bdm
chown -R bdm:bdm /etc/bdm
chmod 750 /etc/bdm

if [[ -f "$ENV_FILE" ]]; then
  chmod 640 "$ENV_FILE"
  chown bdm:bdm "$ENV_FILE"
fi

if [[ -f "$FRONTEND_ENV_FILE" ]]; then
  chmod 640 "$FRONTEND_ENV_FILE"
  chown bdm:bdm "$FRONTEND_ENV_FILE"
fi

chown -R bdm:bdm "$ROOT_DIR"

runuser -u bdm -- python3 -m venv "$ROOT_DIR/backend/.venv"
runuser -u bdm -- "$ROOT_DIR/backend/.venv/bin/pip" install -r "$ROOT_DIR/backend/requirements.txt"

runuser -u bdm -- python3 -m venv "$ROOT_DIR/bot/.venv"
runuser -u bdm -- "$ROOT_DIR/bot/.venv/bin/pip" install -r "$ROOT_DIR/bot/requirements.txt"

if [[ "$BUILD_FRONTEND" == "1" ]]; then
  runuser -u bdm -- bash -lc "cd $ROOT_DIR/frontend && npm ci && npm run build"
fi

if [[ "$SETUP_SYSTEMD" == "1" ]]; then
  cp "$ROOT_DIR/infra/systemd/"*.service /etc/systemd/system/
  systemctl daemon-reload
  if [[ "$START_SERVICES" == "1" ]]; then
    systemctl enable --now bdm-api bdm-celery bdm-celery-beat bdm-bot bdm-frontend
  fi
fi

echo "System install completed"
