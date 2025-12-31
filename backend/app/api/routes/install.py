from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from redis import Redis
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.deps import get_db
from app.core.installer import require_installer_available, require_installer_token
from app.core.security import hash_password
from app.models.section import Section
from app.models.user import User
from app.schemas.install import (
    InstallerAdminIn,
    InstallerBootstrapStatusOut,
    InstallerChecksOut,
    InstallerDbCheckIn,
    InstallerDbCheckOut,
    InstallerEnvIn,
    InstallerEnvOut,
    InstallerFinishOut,
    InstallerFullIn,
    InstallerFullOut,
    InstallerHostCheckIn,
    InstallerHostCheckItem,
    InstallerHostCheckOut,
    InstallerHostCheckResult,
    InstallerMigrateOut,
    InstallerOneClickIn,
    InstallerOneClickOut,
    InstallerPublicStatusOut,
    InstallerSeedIn,
    InstallerSeedOut,
    InstallerStatusOut,
    InstallerStepResult,
    InstallerSystemSetupIn,
    InstallerSystemSetupOut,
)
from app.services.installer import (
    check_database,
    check_tcp,
    default_host_checks,
    get_state_snapshot,
    mark_installed,
    run_migrations,
    seed_database,
)
from app.services.system_setup import (
    parse_env,
    provision_database,
    run_system_install,
    system_paths,
    update_env_key,
    write_env_file,
)

router = APIRouter(prefix="/install", tags=["install"])
logger = logging.getLogger("bdm.install")


def _safe_error_detail(exc: Exception, fallback: str) -> str:
    if settings.app_env == "production":
        return fallback
    return str(exc)


def _safe_output(output: str | None) -> str | None:
    if not output:
        return None
    if settings.app_env == "production":
        return None
    return output


@router.get("/public-status", response_model=InstallerPublicStatusOut)
def installer_public_status() -> InstallerPublicStatusOut:
    snapshot = get_state_snapshot()
    return InstallerPublicStatusOut(
        enabled=settings.installer_enabled, installed=snapshot["installed"]
    )


def _database_uri_from_env(env_values: dict[str, str]) -> str:
    database_url = env_values.get("DATABASE_URL")
    if database_url:
        return database_url
    db_user = env_values.get("DB_USER", settings.db_user)
    db_password = env_values.get("DB_PASSWORD", settings.db_password)
    db_host = env_values.get("DB_HOST", settings.db_host)
    db_port_raw = env_values.get("DB_PORT", str(settings.db_port))
    try:
        db_port = int(db_port_raw)
    except ValueError as exc:
        raise ValueError(f"Invalid DB_PORT: {db_port_raw}") from exc
    db_name = env_values.get("DB_NAME", settings.db_name)
    return URL.create(
        "mysql+pymysql",
        username=db_user,
        password=db_password,
        host=db_host,
        port=db_port,
        database=db_name,
        query={"charset": "utf8mb4"},
    ).render_as_string(hide_password=False)


def _session_for_uri(database_uri: str) -> tuple[Session, object]:
    connect_args: dict[str, object] = {}
    engine_kwargs: dict[str, object] = {
        "pool_pre_ping": True,
        "future": True,
    }
    if database_uri.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if database_uri.endswith(":memory:"):
            engine_kwargs["poolclass"] = StaticPool
    engine = create_engine(database_uri, connect_args=connect_args, **engine_kwargs)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    return session, engine


@router.get(
    "/status", response_model=InstallerStatusOut, dependencies=[Depends(require_installer_token)]
)
def installer_status() -> InstallerStatusOut:
    snapshot = get_state_snapshot()
    return InstallerStatusOut(enabled=settings.installer_enabled, **snapshot)


@router.post(
    "/checks",
    response_model=InstallerChecksOut,
    dependencies=[Depends(require_installer_available)],
)
def installer_checks(db: Session = Depends(get_db)) -> InstallerChecksOut:
    db_ok = check_database(db)
    redis_ok = False
    try:
        redis_client = Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=0.2,
            socket_timeout=0.5,
        )
        redis_ok = redis_client.ping()
    except Exception:
        redis_ok = False

    return InstallerChecksOut(db_ok=db_ok, redis_ok=bool(redis_ok))


@router.post(
    "/hosts-check",
    response_model=InstallerHostCheckOut,
    dependencies=[Depends(require_installer_token)],
)
def installer_hosts_check(payload: InstallerHostCheckIn) -> InstallerHostCheckOut:
    items = payload.items
    if not items:
        items = [InstallerHostCheckItem(**item) for item in default_host_checks()]
    results: list[InstallerHostCheckResult] = []
    for item in items:
        ok, error = check_tcp(item.host, item.port, item.timeout_ms)
        results.append(
            InstallerHostCheckResult(
                name=item.name,
                host=item.host,
                port=item.port,
                ok=ok,
                error=error,
            )
        )
    return InstallerHostCheckOut(results=results)


@router.get(
    "/bootstrap-status",
    response_model=InstallerBootstrapStatusOut,
    dependencies=[Depends(require_installer_token)],
)
def installer_bootstrap_status() -> InstallerBootstrapStatusOut:
    env_dir = Path("/etc/bdm")
    env_dir_exists = env_dir.exists()
    env_dir_writable = env_dir_exists and os.access(env_dir, os.W_OK)
    sudoers_present = Path("/etc/sudoers.d/bdm-installer").exists()
    repo_root = Path(__file__).resolve().parents[4]
    system_install_exists = (repo_root / "scripts" / "system_install.sh").exists()
    return InstallerBootstrapStatusOut(
        env_dir_exists=env_dir_exists,
        env_dir_writable=env_dir_writable,
        sudoers_present=sudoers_present,
        system_install_exists=system_install_exists,
    )


@router.post(
    "/env", response_model=InstallerEnvOut, dependencies=[Depends(require_installer_token)]
)
def installer_env(payload: InstallerEnvIn) -> InstallerEnvOut:
    paths = system_paths()
    try:
        write_env_file(paths["env_file"], payload.backend_env)
        write_env_file(paths["frontend_env_file"], payload.frontend_env)
    except OSError as exc:
        logger.exception("Installer env write failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_safe_error_detail(exc, "Failed to write env files"),
        ) from exc

    return InstallerEnvOut(status="ok")


@router.post(
    "/db-check", response_model=InstallerDbCheckOut, dependencies=[Depends(require_installer_token)]
)
def installer_db_check(payload: InstallerDbCheckIn) -> InstallerDbCheckOut:
    env_values = parse_env(payload.backend_env)
    try:
        database_uri = _database_uri_from_env(env_values)
    except Exception as exc:
        logger.exception("Installer db uri parsing failed")
        return InstallerDbCheckOut(
            db_ok=False,
            error=_safe_error_detail(exc, "Invalid database settings"),
        )

    try:
        db_session, engine = _session_for_uri(database_uri)
    except Exception as exc:
        logger.exception("Installer db session setup failed")
        return InstallerDbCheckOut(
            db_ok=False,
            error=_safe_error_detail(exc, "Database connection failed"),
        )

    try:
        db_session.execute(text("SELECT 1"))
        return InstallerDbCheckOut(db_ok=True)
    except SQLAlchemyError as exc:
        logger.exception("Installer db check failed")
        error = _safe_error_detail(exc, "Database connection failed")
        return InstallerDbCheckOut(db_ok=False, error=error)
    finally:
        db_session.close()
        engine.dispose()


@router.post(
    "/system-setup",
    response_model=InstallerSystemSetupOut,
    dependencies=[Depends(require_installer_token)],
)
def installer_system_setup(payload: InstallerSystemSetupIn) -> InstallerSystemSetupOut:
    paths = system_paths()
    ok, output = run_system_install(
        {
            "env_file": paths["env_file"],
            "frontend_env_file": paths["frontend_env_file"],
            "install_node": payload.install_node,
            "install_redis": payload.install_redis,
            "use_nodesource": payload.use_nodesource,
            "build_frontend": payload.build_frontend,
            "setup_systemd": payload.setup_systemd,
            "start_services": payload.start_services,
        }
    )

    if not ok:
        log_extra = {"output": output} if settings.app_env != "production" and output else {}
        logger.error("Installer system setup failed", extra=log_extra)

    return InstallerSystemSetupOut(status="ok" if ok else "failed", output=_safe_output(output))


@router.post(
    "/migrate",
    response_model=InstallerMigrateOut,
    dependencies=[Depends(require_installer_available)],
)
def installer_migrate() -> InstallerMigrateOut:
    try:
        run_migrations()
    except Exception as exc:
        logger.exception("Installer migration failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_safe_error_detail(exc, "Migration failed"),
        ) from exc

    return InstallerMigrateOut(status="ok")


@router.post(
    "/admin", response_model=InstallerFinishOut, dependencies=[Depends(require_installer_available)]
)
def installer_admin(payload: InstallerAdminIn, db: Session = Depends(get_db)) -> InstallerFinishOut:
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        return InstallerFinishOut(status="exists")

    password_bytes = payload.password.encode("utf-8")
    if len(password_bytes) > 72:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be <=72 bytes (got {len(password_bytes)}).",
        )

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return InstallerFinishOut(status="created")


@router.post(
    "/seed", response_model=InstallerSeedOut, dependencies=[Depends(require_installer_available)]
)
def installer_seed(payload: InstallerSeedIn, db: Session = Depends(get_db)) -> InstallerSeedOut:
    author = db.query(User).filter(User.username == payload.author_username).first()
    if not author:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Author not found")

    seed_database(db, author, upsert=payload.upsert)
    return InstallerSeedOut(status="ok")


@router.post(
    "/finish",
    response_model=InstallerFinishOut,
    dependencies=[Depends(require_installer_available)],
)
def installer_finish(db: Session = Depends(get_db)) -> InstallerFinishOut:
    admin_user = db.query(User).filter(User.role == "admin").order_by(User.created_at.asc()).first()
    admin_id = admin_user.id if admin_user else None
    seed_applied = db.query(Section).count() > 0
    mark_installed(db, admin_id, seed_applied=seed_applied)
    paths = system_paths()
    try:
        update_env_key(paths["env_file"], "INSTALLER_ENABLED", "0")
    except Exception as exc:
        logger.exception("Installer finish update failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_safe_error_detail(exc, "Failed to finalize installer"),
        ) from exc
    return InstallerFinishOut(status="ok")


def _run_one_click(payload: InstallerOneClickIn, db: Session) -> InstallerOneClickOut:
    steps: list[InstallerStepResult] = []
    env_values = parse_env(payload.backend_env) if payload.backend_env else {}
    try:
        database_uri = (
            _database_uri_from_env(env_values)
            if payload.backend_env
            else settings.sqlalchemy_database_uri()
        )
    except Exception as exc:
        logger.exception("Installer one-click preparation failed")
        steps.append(
            InstallerStepResult(
                step="prepare",
                status="failed",
                detail=_safe_error_detail(exc, "Preparation failed"),
            )
        )
        return InstallerOneClickOut(status="failed", steps=steps)
    redis_url = env_values.get("REDIS_URL", settings.redis_url)
    db_session = db
    engine = None
    owns_session = bool(payload.backend_env)
    if owns_session:
        try:
            db_session, engine = _session_for_uri(database_uri)
        except Exception as exc:
            logger.exception("Installer one-click session setup failed")
            steps.append(
                InstallerStepResult(
                    step="prepare",
                    status="failed",
                    detail=_safe_error_detail(exc, "Database connection failed"),
                )
            )
            return InstallerOneClickOut(status="failed", steps=steps)

    db_error: str | None = None
    try:
        db_session.execute(text("SELECT 1"))
        db_ok = True
    except SQLAlchemyError as exc:
        db_ok = False
        logger.exception("Installer one-click db check failed")
        db_error = _safe_error_detail(exc, "Database connection failed")
    redis_ok = False
    try:
        redis_client = Redis.from_url(
            redis_url,
            socket_connect_timeout=0.2,
            socket_timeout=0.5,
        )
        redis_ok = redis_client.ping()
    except Exception:
        redis_ok = False

    if not db_ok or not redis_ok:
        detail = f"db_ok={db_ok}, redis_ok={redis_ok}"
        if db_error:
            detail += f", db_error={db_error}"
        steps.append(InstallerStepResult(step="checks", status="failed", detail=detail))
        result = InstallerOneClickOut(status="failed", steps=steps)
        if owns_session and engine:
            db_session.close()
            engine.dispose()
        return result

    steps.append(InstallerStepResult(step="checks", status="ok"))

    try:
        run_migrations(database_uri if payload.backend_env else None)
        steps.append(InstallerStepResult(step="migrate", status="ok"))
    except Exception as exc:
        logger.exception("Installer migrations failed")
        steps.append(
            InstallerStepResult(
                step="migrate",
                status="failed",
                detail=_safe_error_detail(exc, "Migration failed"),
            )
        )
        result = InstallerOneClickOut(status="failed", steps=steps)
        if owns_session and engine:
            db_session.close()
            engine.dispose()
        return result

    try:
        existing = db_session.query(User).filter(User.username == payload.admin.username).first()
    except Exception as exc:
        logger.exception("Installer admin lookup failed")
        steps.append(
            InstallerStepResult(
                step="admin",
                status="failed",
                detail=_safe_error_detail(exc, "Failed to check admin user"),
            )
        )
        if owns_session and engine:
            db_session.close()
            engine.dispose()
        return InstallerOneClickOut(status="failed", steps=steps)
    if existing:
        steps.append(InstallerStepResult(step="admin", status="exists"))
        admin_user = existing
    else:
        password_bytes = payload.admin.password.encode("utf-8")
        if len(password_bytes) > 72:
            steps.append(
                InstallerStepResult(
                    step="admin",
                    status="failed",
                    detail=f"Password must be <=72 bytes (got {len(password_bytes)}).",
                )
            )
            result = InstallerOneClickOut(status="failed", steps=steps)
            if owns_session and engine:
                db_session.close()
                engine.dispose()
            return result
        try:
            user = User(
                username=payload.admin.username,
                password_hash=hash_password(payload.admin.password),
                role=payload.admin.role,
                is_active=True,
            )
            db_session.add(user)
            db_session.commit()
            db_session.refresh(user)
            admin_user = user
            steps.append(InstallerStepResult(step="admin", status="created"))
        except Exception as exc:
            logger.exception("Installer admin create failed")
            steps.append(
                InstallerStepResult(
                    step="admin",
                    status="failed",
                    detail=_safe_error_detail(exc, "Failed to create admin user"),
                )
            )
            result = InstallerOneClickOut(status="failed", steps=steps)
            if owns_session and engine:
                db_session.close()
                engine.dispose()
            return result

    if payload.seed:
        try:
            seed_database(db_session, admin_user, upsert=payload.seed_upsert)
            steps.append(InstallerStepResult(step="seed", status="ok"))
        except Exception as exc:
            logger.exception("Installer seed failed")
            steps.append(
                InstallerStepResult(
                    step="seed",
                    status="failed",
                    detail=_safe_error_detail(exc, "Seeding failed"),
                )
            )
            result = InstallerOneClickOut(status="failed", steps=steps)
            if owns_session and engine:
                db_session.close()
                engine.dispose()
            return result
    else:
        steps.append(InstallerStepResult(step="seed", status="skipped"))

    if payload.finish:
        try:
            seed_applied = db_session.query(Section).count() > 0
            mark_installed(db_session, admin_user.id, seed_applied=seed_applied)
            steps.append(InstallerStepResult(step="finish", status="ok"))
        except Exception as exc:
            logger.exception("Installer finish failed")
            steps.append(
                InstallerStepResult(
                    step="finish",
                    status="failed",
                    detail=_safe_error_detail(exc, "Finish failed"),
                )
            )
            result = InstallerOneClickOut(status="failed", steps=steps)
            if owns_session and engine:
                db_session.close()
                engine.dispose()
            return result
    else:
        steps.append(InstallerStepResult(step="finish", status="skipped"))

    if payload.finish and payload.disable_installer:
        paths = system_paths()
        try:
            update_env_key(paths["env_file"], "INSTALLER_ENABLED", "0")
            steps.append(InstallerStepResult(step="disable_installer", status="ok"))
        except Exception as exc:
            logger.exception("Installer disable failed")
            steps.append(
                InstallerStepResult(
                    step="disable_installer",
                    status="failed",
                    detail=_safe_error_detail(exc, "Failed to disable installer"),
                )
            )
            result = InstallerOneClickOut(status="failed", steps=steps)
            if owns_session and engine:
                db_session.close()
                engine.dispose()
            return result

    result = InstallerOneClickOut(status="ok", steps=steps)
    if owns_session and engine:
        db_session.close()
        engine.dispose()
    return result


@router.post(
    "/one-click",
    response_model=InstallerOneClickOut,
    dependencies=[Depends(require_installer_available)],
)
def installer_one_click(
    payload: InstallerOneClickIn, db: Session = Depends(get_db)
) -> InstallerOneClickOut:
    try:
        return _run_one_click(payload, db)
    except Exception as exc:
        logger.exception("Installer one-click failed")
        return InstallerOneClickOut(
            status="failed",
            steps=[
                InstallerStepResult(
                    step="unexpected",
                    status="failed",
                    detail=_safe_error_detail(exc, "Unexpected error"),
                )
            ],
        )


@router.post(
    "/full", response_model=InstallerFullOut, dependencies=[Depends(require_installer_available)]
)
def installer_full(payload: InstallerFullIn, db: Session = Depends(get_db)) -> InstallerFullOut:
    steps: list[InstallerStepResult] = []
    output = ""

    paths = system_paths()
    try:
        write_env_file(paths["env_file"], payload.backend_env)
        write_env_file(paths["frontend_env_file"], payload.frontend_env)
        steps.append(InstallerStepResult(step="write_env", status="ok"))
    except Exception as exc:
        logger.exception("Installer env write failed")
        steps.append(
            InstallerStepResult(
                step="write_env",
                status="failed",
                detail=_safe_error_detail(exc, "Failed to write env files"),
            )
        )
        return InstallerFullOut(status="failed", steps=steps, output=_safe_output(output))

    env_values = parse_env(payload.backend_env)

    if payload.provision_db:
        root_user = payload.db_root_user or ""
        root_password = payload.db_root_password or ""
        if not root_user or not root_password:
            steps.append(
                InstallerStepResult(
                    step="provision_db", status="failed", detail="Missing DB root credentials"
                )
            )
            return InstallerFullOut(status="failed", steps=steps, output=output)
        app_user = env_values.get("DB_USER", settings.db_user)
        app_password = env_values.get("DB_PASSWORD", settings.db_password)
        if not app_user or not app_password:
            steps.append(
                InstallerStepResult(
                    step="provision_db", status="failed", detail="Missing DB user credentials"
                )
            )
            return InstallerFullOut(status="failed", steps=steps, output=output)
        try:
            provision_database(
                host=env_values.get("DB_HOST", settings.db_host),
                port=int(env_values.get("DB_PORT", settings.db_port)),
                root_user=root_user,
                root_password=root_password,
                db_name=env_values.get("DB_NAME", settings.db_name),
                app_user=app_user,
                app_password=app_password,
                app_host=payload.db_user_host,
            )
            steps.append(InstallerStepResult(step="provision_db", status="ok"))
        except Exception as exc:
            logger.exception("Installer provision db failed")
            steps.append(
                InstallerStepResult(
                    step="provision_db",
                    status="failed",
                    detail=_safe_error_detail(exc, "Database provisioning failed"),
                )
            )
            return InstallerFullOut(status="failed", steps=steps, output=_safe_output(output))

    ok, script_output = run_system_install(
        {
            "env_file": paths["env_file"],
            "frontend_env_file": paths["frontend_env_file"],
            "install_node": payload.install_node,
            "install_redis": payload.install_redis,
            "use_nodesource": payload.use_nodesource,
            "build_frontend": payload.build_frontend,
            "setup_systemd": payload.setup_systemd,
            "start_services": payload.start_services,
        }
    )
    output = _safe_output(script_output)
    if ok:
        steps.append(InstallerStepResult(step="system_install", status="ok"))
    else:
        log_extra = (
            {"output": script_output} if settings.app_env != "production" and script_output else {}
        )
        logger.error("Installer system install failed", extra=log_extra)
        steps.append(InstallerStepResult(step="system_install", status="failed"))
        return InstallerFullOut(status="failed", steps=steps, output=output)

    one_click = _run_one_click(
        InstallerOneClickIn(
            admin=payload.admin,
            seed=payload.seed,
            seed_upsert=payload.seed_upsert,
            finish=payload.finish,
            disable_installer=False,
            backend_env=payload.backend_env,
        ),
        db,
    )
    steps.extend(one_click.steps)
    if one_click.status != "ok":
        return InstallerFullOut(status="failed", steps=steps, output=output)

    if payload.disable_installer and payload.finish:
        try:
            update_env_key(paths["env_file"], "INSTALLER_ENABLED", "0")
            steps.append(InstallerStepResult(step="disable_installer", status="ok"))
        except Exception as exc:
            logger.exception("Installer disable failed")
            steps.append(
                InstallerStepResult(
                    step="disable_installer",
                    status="failed",
                    detail=_safe_error_detail(exc, "Failed to disable installer"),
                )
            )
            return InstallerFullOut(status="failed", steps=steps, output=output)

    return InstallerFullOut(status="ok", steps=steps, output=output)
