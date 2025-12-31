from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Any

import pymysql


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def write_env_file(path: str, content: str) -> None:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    content_clean = content.strip() + "\n"
    file_path.write_text(content_clean, encoding="utf-8")


def update_env_key(path: str, key: str, value: str) -> None:
    file_path = Path(path)
    if not file_path.exists():
        return
    lines = file_path.read_text(encoding="utf-8").splitlines()
    updated = False
    new_lines: list[str] = []
    for line in lines:
        if not line or line.strip().startswith("#") or "=" not in line:
            new_lines.append(line)
            continue
        env_key, _ = line.split("=", 1)
        if env_key == key:
            new_lines.append(f"{key}={value}")
            updated = True
        else:
            new_lines.append(line)
    if not updated:
        new_lines.append(f"{key}={value}")
    file_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


def parse_env(content: str) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def _quote_identifier(value: str) -> str:
    safe = value.replace("`", "``")
    return f"`{safe}`"


def provision_database(
    host: str,
    port: int,
    root_user: str,
    root_password: str,
    db_name: str,
    app_user: str,
    app_password: str,
    app_host: str,
) -> None:
    connection = pymysql.connect(
        host=host,
        user=root_user,
        password=root_password,
        port=port,
        charset="utf8mb4",
        autocommit=True,
    )
    try:
        with connection.cursor() as cursor:
            db_identifier = _quote_identifier(db_name)
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS {db_identifier} "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            cursor.execute(
                "CREATE USER IF NOT EXISTS %s@%s IDENTIFIED BY %s",
                (app_user, app_host, app_password),
            )
            cursor.execute(
                f"GRANT ALL PRIVILEGES ON {db_identifier}.* TO %s@%s",
                (app_user, app_host),
            )
            cursor.execute("FLUSH PRIVILEGES")
    finally:
        connection.close()


def run_system_install(options: dict[str, Any]) -> tuple[bool, str]:
    repo_root = _repo_root()
    script_path = repo_root / "scripts" / "system_install.sh"

    env = os.environ.copy()
    env["BDM_ROOT"] = str(repo_root)
    env["ENV_FILE"] = options.get("env_file", "/etc/bdm/bdm.env")
    env["FRONTEND_ENV_FILE"] = options.get("frontend_env_file", "/etc/bdm/frontend.env")

    flags = {
        "INSTALL_NODE": options.get("install_node", True),
        "INSTALL_REDIS": options.get("install_redis", True),
        "USE_NODESOURCE": options.get("use_nodesource", True),
        "BUILD_FRONTEND": options.get("build_frontend", True),
        "SETUP_SYSTEMD": options.get("setup_systemd", True),
        "START_SERVICES": options.get("start_services", True),
    }
    for key, value in flags.items():
        env[key] = "1" if value else "0"

    cmd = [str(script_path)]
    if os.geteuid() != 0:
        cmd = ["sudo", "-n"] + cmd

    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    output = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
    return result.returncode == 0, output.strip()


def system_paths() -> dict[str, str]:
    return {
        "env_file": "/etc/bdm/bdm.env",
        "frontend_env_file": "/etc/bdm/frontend.env",
    }
