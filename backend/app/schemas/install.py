from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class InstallerStatusOut(BaseModel):
    enabled: bool
    db_ok: bool
    installed: bool


class InstallerPublicStatusOut(BaseModel):
    enabled: bool
    installed: bool


class InstallerChecksOut(BaseModel):
    db_ok: bool
    redis_ok: bool


class InstallerMigrateOut(BaseModel):
    status: str


class InstallerAdminIn(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^@[A-Za-z0-9_]{3,32}$")
    password: str = Field(min_length=8, max_length=128)
    role: Literal["user", "moderator", "admin"] = "admin"


class InstallerSeedIn(BaseModel):
    author_username: str = Field(min_length=3, max_length=64, pattern=r"^@[A-Za-z0-9_]{3,32}$")
    upsert: bool = False


class InstallerSeedOut(BaseModel):
    status: str


class InstallerFinishOut(BaseModel):
    status: str


class InstallerHostCheckItem(BaseModel):
    name: str
    host: str
    port: int = Field(ge=1, le=65535)
    timeout_ms: int | None = Field(default=None, ge=100, le=10000)


class InstallerHostCheckIn(BaseModel):
    items: list[InstallerHostCheckItem] = Field(default_factory=list)


class InstallerHostCheckResult(BaseModel):
    name: str
    host: str
    port: int
    ok: bool
    error: str | None = None


class InstallerHostCheckOut(BaseModel):
    results: list[InstallerHostCheckResult]


class InstallerBootstrapStatusOut(BaseModel):
    env_dir_exists: bool
    env_dir_writable: bool
    sudoers_present: bool
    system_install_exists: bool


class InstallerEnvIn(BaseModel):
    backend_env: str
    frontend_env: str


class InstallerEnvOut(BaseModel):
    status: str


class InstallerDbCheckIn(BaseModel):
    backend_env: str


class InstallerDbCheckOut(BaseModel):
    db_ok: bool
    error: str | None = None


class InstallerSystemSetupIn(BaseModel):
    install_node: bool = True
    install_redis: bool = True
    use_nodesource: bool = True
    build_frontend: bool = True
    setup_systemd: bool = True
    start_services: bool = True


class InstallerSystemSetupOut(BaseModel):
    status: str
    output: str | None = None


class InstallerOneClickIn(BaseModel):
    admin: InstallerAdminIn
    seed: bool = True
    seed_upsert: bool = True
    finish: bool = True
    disable_installer: bool = True
    backend_env: str | None = None


class InstallerStepResult(BaseModel):
    step: str
    status: str
    detail: str | None = None


class InstallerOneClickOut(BaseModel):
    status: str
    steps: list[InstallerStepResult]


class InstallerFullIn(BaseModel):
    backend_env: str
    frontend_env: str
    admin: InstallerAdminIn
    seed: bool = True
    seed_upsert: bool = True
    finish: bool = True
    disable_installer: bool = True

    provision_db: bool = False
    db_root_user: str | None = None
    db_root_password: str | None = None
    db_user_host: str = "192.168.20.4"

    install_node: bool = True
    install_redis: bool = True
    use_nodesource: bool = True
    build_frontend: bool = True
    setup_systemd: bool = True
    start_services: bool = True


class InstallerFullOut(BaseModel):
    status: str
    steps: list[InstallerStepResult]
    output: str | None = None
