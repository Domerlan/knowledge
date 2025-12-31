#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Backend dependencies (pip-audit) =="
if ! command -v pip-audit >/dev/null 2>&1; then
  echo "pip-audit not found. Install it with: python3 -m pip install pip-audit"
  exit 1
fi
pip-audit -r "${ROOT_DIR}/backend/requirements.txt"

echo "== Frontend dependencies (npm audit) =="
cd "${ROOT_DIR}/frontend"
npm audit --omit=dev
