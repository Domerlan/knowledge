#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=${BDM_ROOT:-/opt/bdm-knowledge}
SYSTEM_INSTALL_SCRIPT="$ROOT_DIR/scripts/system_install.sh"
SUDOERS_FILE="/etc/sudoers.d/bdm-installer"

if [[ $EUID -ne 0 ]]; then
  echo "This script must run as root (sudo)." >&2
  exit 1
fi

if [[ ! -f "$SYSTEM_INSTALL_SCRIPT" ]]; then
  echo "Missing installer script: $SYSTEM_INSTALL_SCRIPT" >&2
  exit 1
fi

if ! id -u bdm >/dev/null 2>&1; then
  useradd -m -s /bin/bash bdm
fi

mkdir -p /etc/bdm
chown -R bdm:bdm /etc/bdm
chmod 750 /etc/bdm

cat <<EOF | tee "$SUDOERS_FILE" >/dev/null
bdm ALL=(root) NOPASSWD: $SYSTEM_INSTALL_SCRIPT, /bin/bash $SYSTEM_INSTALL_SCRIPT, /usr/bin/bash $SYSTEM_INSTALL_SCRIPT
EOF
chmod 440 "$SUDOERS_FILE"

echo "Web installer bootstrap completed."
echo "You can now run the System setup step from the web installer."
