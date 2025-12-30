"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type InstallerStatus = {
  enabled: boolean;
  db_ok: boolean;
  installed: boolean;
};

type InstallerConfig = {
  baseUrl: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  redisUrl: string;
  jwtSecret: string;
  telegramBotToken: string;
  backendBaseUrl: string;
  apiBase: string;
  apiInternal: string;
};

type HostCheckResult = {
  name: string;
  host: string;
  port: number;
  ok: boolean;
  error?: string | null;
};

type InstallResult = {
  status: string;
  steps: { step: string; status: string; detail?: string | null }[];
};

type SystemSetupResult = {
  status: string;
  output?: string | null;
};

type DbCheckResult = {
  db_ok: boolean;
  error?: string | null;
};

type BootstrapStatus = {
  env_dir_exists: boolean;
  env_dir_writable: boolean;
  sudoers_present: boolean;
  system_install_exists: boolean;
};

type InstallerPersistedState = {
  version: 1;
  lang: "ru" | "en";
  currentStep: number;
  token: string;
  config: InstallerConfig;
  admin: {
    username: string;
    password: string;
    role: string;
  };
  seedUpsert: boolean;
  configSaved: boolean;
  hostChecks: HostCheckResult[];
  dbCheckResult: DbCheckResult | null;
  systemSetupResult: SystemSetupResult | null;
  installResult: InstallResult | null;
  installCompleted: boolean;
  installNode: boolean;
  installRedis: boolean;
  useNodesource: boolean;
  buildFrontend: boolean;
  setupSystemd: boolean;
  startServices: boolean;
};

type Copy = {
  languageLabel: string;
  title: string;
  intro: string;
  progressLabel: (current: number, total: number) => string;
  prevStep: string;
  nextStep: string;
  bootstrapStepTitle: string;
  bootstrapStepSubtitle: string;
  bootstrapNote: string;
  bootstrapCheckButton: string;
  bootstrapStatusTitle: string;
  bootstrapStatusHint: string;
  bootstrapEnvDir: string;
  bootstrapSudoers: string;
  bootstrapScript: string;
  bootstrapOk: string;
  bootstrapFail: string;
  step0Title: string;
  step0Subtitle: string;
  step1Title: string;
  step1Subtitle: string;
  tokenLabel: string;
  checkStatus: string;
  checkStatusHint: string;
  statusLine: (status: InstallerStatus) => string;
  installerDisabledHint: string;
  step2Title: string;
  step2Subtitle: string;
  step2Note: string;
  dbCheckButton: string;
  dbCheckHint: string;
  dbCheckOk: string;
  saveConfig: string;
  saveConfigHint: string;
  configSavePermissionHint: string;
  bootstrapTitle: string;
  bootstrapDescription: string;
  bootstrapCommand: string;
  backendEnvLabel: string;
  frontendEnvLabel: string;
  downloadBackendEnv: string;
  downloadFrontendEnv: string;
  step3Title: string;
  step3Subtitle: string;
  step3Note: string;
  runHostChecks: string;
  hostChecksHint: string;
  hostOk: string;
  hostFail: string;
  systemSetupTitle: string;
  systemSetupSubtitle: string;
  installNodeLabel: string;
  installRedisLabel: string;
  useNodesourceLabel: string;
  buildFrontendLabel: string;
  setupSystemdLabel: string;
  startServicesLabel: string;
  runSystemSetup: string;
  step4Title: string;
  step4Subtitle: string;
  passwordPlaceholder: string;
  rolePlaceholder: string;
  step5Title: string;
  step5Subtitle: string;
  adminFormTitle: string;
  adminFormSubtitle: string;
  adminReviewEmpty: string;
  installNote: string;
  upsertSeedLabel: string;
  runInstall: string;
  step6Title: string;
  step6Subtitle: string;
  finishNote: string;
  finishHideInstallerHint: string;
  finishRestartHint: string;
  finishDisableFailed: string;
  finishCta: string;
  statusLabel: string;
  messages: {
    configSaved: string;
    systemSetupDone: string;
    installFinished: string;
  };
  errors: {
    statusFailed: string;
    configSaveFailed: string;
    dbCheckFailed: string;
    hostChecksFailed: string;
    systemSetupFailed: string;
    installFailed: string;
  };
};

const copy: Record<"ru" | "en", Copy> = {
  en: {
    languageLabel: "Language",
    title: "Web Installer",
    intro:
      "Follow each step in order. Configuration is saved on the server and then used for setup.",
    progressLabel: (current, total) => `Step ${current} of ${total}`,
    prevStep: "Back",
    nextStep: "Next step",
    bootstrapStepTitle: "Bootstrap",
    bootstrapStepSubtitle: "One-time server setup so the installer can complete system tasks.",
    bootstrapNote: "Run the command below on the server before using system setup.",
    bootstrapCheckButton: "Check bootstrap",
    bootstrapStatusTitle: "Bootstrap status",
    bootstrapStatusHint: "All items must be OK to run system setup from the browser.",
    bootstrapEnvDir: "/etc/bdm is writable",
    bootstrapSudoers: "sudoers rule installed",
    bootstrapScript: "system_install.sh exists",
    bootstrapOk: "ok",
    bootstrapFail: "missing",
    step0Title: "Language",
    step0Subtitle: "Choose the installer interface language to begin.",
    step1Title: "Installer access",
    step1Subtitle: "Enter the installer token and verify access before you begin.",
    tokenLabel: "Installer token",
    checkStatus: "Check status",
    checkStatusHint: "Shows whether the installer is enabled and if installation is completed.",
    statusLine: (status) =>
      `Installer: ${status.enabled ? "enabled" : "disabled"} · Installed: ${
        status.installed ? "yes" : "no"
      }`,
    installerDisabledHint:
      "Installer is disabled. Set INSTALLER_ENABLED=1 in backend env and restart the API service.",
    step2Title: "Configuration",
    step2Subtitle: "Fill in database, Redis, and secrets. The installer will write env files to /etc/bdm.",
    step2Note: "Required fields are marked with *.",
    dbCheckButton: "Check DB login",
    dbCheckHint: "Tests DB username and password with the values from this step.",
    dbCheckOk: "Database login successful.",
    saveConfig: "Save config on server",
    saveConfigHint: "Writes env files to /etc/bdm.",
    configSavePermissionHint:
      "Permission denied. Run the bootstrap command below to allow writing /etc/bdm, then save again.",
    bootstrapTitle: "One-time bootstrap required",
    bootstrapDescription:
      "Run this command on the server to allow the installer to write /etc/bdm and run system setup.",
    bootstrapCommand: "sudo /opt/bdm-knowledge/scripts/enable_web_installer.sh",
    backendEnvLabel: "backend .env",
    frontendEnvLabel: "frontend .env",
    downloadBackendEnv: "Download backend env",
    downloadFrontendEnv: "Download frontend env",
    step3Title: "Connectivity and system setup",
    step3Subtitle: "Check database/Redis connectivity and run optional server setup.",
    step3Note: "Uses the values from Step 04.",
    runHostChecks: "Check DB/Redis hosts",
    hostChecksHint: "Tests TCP connectivity from this server.",
    hostOk: "ok",
    hostFail: "failed",
    systemSetupTitle: "System setup (optional)",
    systemSetupSubtitle:
      "Installs Node.js/Redis, builds the frontend, installs systemd units, and can start services.",
    installNodeLabel: "Install Node.js",
    installRedisLabel: "Install Redis",
    useNodesourceLabel: "Use NodeSource repository",
    buildFrontendLabel: "Build frontend",
    setupSystemdLabel: "Install systemd units",
    startServicesLabel: "Start services after setup",
    runSystemSetup: "Run system setup",
    step4Title: "Admin credentials",
    step4Subtitle: "Review the admin creation status after the install step.",
    adminFormTitle: "Admin credentials",
    adminFormSubtitle: "Used during Step 06 to create the first admin account.",
    adminReviewEmpty: "Run the application install step first.",
    passwordPlaceholder: "Password",
    rolePlaceholder: "Role (admin)",
    step5Title: "Application install",
    step5Subtitle:
      "Connects to the database using the values from Step 04, creates tables, admin, seed data, and disables the installer.",
    installNote:
      "Uses the database credentials from Step 04 to create tables. Redis must be reachable from this server.",
    upsertSeedLabel: "Upsert seed data",
    runInstall: "Run install",
    step6Title: "Finish",
    step6Subtitle: "Installation is complete.",
    finishNote: "Installer has been disabled in /etc/bdm/bdm.env. Restart the API service to apply it.",
    finishHideInstallerHint:
      "To hide the installer route completely, run: mv frontend/src/app/install frontend/src/app/_install.disabled",
    finishRestartHint: "If the installer still appears, restart the API service.",
    finishDisableFailed:
      "Installer could not be disabled automatically. Set INSTALLER_ENABLED=0 in /etc/bdm/bdm.env and restart the API service.",
    finishCta: "Go to site",
    statusLabel: "Status",
    messages: {
      configSaved: "Configuration saved to /etc/bdm.",
      systemSetupDone: "System setup completed.",
      installFinished: "Installation completed. You can now open the site.",
    },
    errors: {
      statusFailed: "Failed to load status",
      configSaveFailed: "Failed to save configuration",
      dbCheckFailed: "Database login failed",
      hostChecksFailed: "Host checks failed",
      systemSetupFailed: "System setup failed",
      installFailed: "Install failed",
    },
  },
  ru: {
    languageLabel: "Язык",
    title: "Мастер установки",
    intro:
      "Следуйте шагам по порядку. Конфигурация сохраняется на сервере и используется далее.",
    progressLabel: (current, total) => `Шаг ${current} из ${total}`,
    prevStep: "Назад",
    nextStep: "Дальше",
    bootstrapStepTitle: "Bootstrap",
    bootstrapStepSubtitle: "Единовременная подготовка сервера для системных шагов.",
    bootstrapNote: "Выполните команду ниже на сервере перед системной установкой.",
    bootstrapCheckButton: "Проверить bootstrap",
    bootstrapStatusTitle: "Статус bootstrap",
    bootstrapStatusHint: "Для системной установки все пункты должны быть OK.",
    bootstrapEnvDir: "/etc/bdm доступна для записи",
    bootstrapSudoers: "sudoers правило установлено",
    bootstrapScript: "system_install.sh существует",
    bootstrapOk: "ok",
    bootstrapFail: "нет",
    step0Title: "Выбор языка",
    step0Subtitle: "Выберите язык интерфейса установщика, затем продолжайте.",
    step1Title: "Доступ к установщику",
    step1Subtitle: "Введите токен и проверьте доступ перед началом.",
    tokenLabel: "Токен установщика",
    checkStatus: "Проверить статус",
    checkStatusHint: "Показывает, включён ли установщик и завершена ли установка.",
    statusLine: (status) =>
      `Установщик: ${status.enabled ? "включён" : "выключен"} · Установлено: ${
        status.installed ? "да" : "нет"
      }`,
    installerDisabledHint:
      "Установщик выключен. Включите INSTALLER_ENABLED=1 в env и перезапустите API сервис.",
    step2Title: "Конфигурация",
    step2Subtitle: "Заполните БД, Redis и секреты. Установщик запишет env в /etc/bdm.",
    step2Note: "Обязательные поля отмечены *.",
    dbCheckButton: "Проверить логин БД",
    dbCheckHint: "Проверяет логин и пароль БД из этого шага.",
    dbCheckOk: "Подключение к БД успешно.",
    saveConfig: "Сохранить на сервере",
    saveConfigHint: "Записывает env-файлы в /etc/bdm.",
    configSavePermissionHint:
      "Нет прав на запись. Выполните bootstrap-команду ниже и сохраните ещё раз.",
    bootstrapTitle: "Нужен один раз bootstrap",
    bootstrapDescription:
      "Выполните команду на сервере, чтобы установщик мог писать в /etc/bdm и запускать системную установку.",
    bootstrapCommand: "sudo /opt/bdm-knowledge/scripts/enable_web_installer.sh",
    backendEnvLabel: "backend .env",
    frontendEnvLabel: "frontend .env",
    downloadBackendEnv: "Скачать backend env",
    downloadFrontendEnv: "Скачать frontend env",
    step3Title: "Подключение и системная подготовка",
    step3Subtitle: "Проверьте доступность БД/Redis и при необходимости подготовьте сервер.",
    step3Note: "Используются значения из шага 04.",
    runHostChecks: "Проверить БД/Redis",
    hostChecksHint: "TCP-проверка доступности с этого сервера.",
    hostOk: "ок",
    hostFail: "ошибка",
    systemSetupTitle: "Системная установка (опционально)",
    systemSetupSubtitle:
      "Устанавливает Node.js/Redis, собирает фронтенд, ставит systemd юниты и может запустить сервисы.",
    installNodeLabel: "Установить Node.js",
    installRedisLabel: "Установить Redis",
    useNodesourceLabel: "Использовать репозиторий NodeSource",
    buildFrontendLabel: "Собрать фронтенд",
    setupSystemdLabel: "Установить systemd юниты",
    startServicesLabel: "Запустить сервисы после установки",
    runSystemSetup: "Запустить системную установку",
    step4Title: "Учётка администратора",
    step4Subtitle: "Проверьте статус создания администратора после установки.",
    adminFormTitle: "Данные администратора",
    adminFormSubtitle: "Используются на шаге 06 для создания первого администратора.",
    adminReviewEmpty: "Сначала запустите установку приложения на шаге 06.",
    passwordPlaceholder: "Пароль",
    rolePlaceholder: "Роль (admin)",
    step5Title: "Установка приложения",
    step5Subtitle:
      "Подключается к БД по данным из шага 04, создаёт таблицы, администратора, сид и отключает установщик.",
    installNote:
      "Использует логин/пароль БД из шага 04 и создаёт таблицы автоматически. Redis должен быть доступен с этого сервера.",
    upsertSeedLabel: "Обновлять сид-данные",
    runInstall: "Запустить установку",
    step6Title: "Готово",
    step6Subtitle: "Установка завершена.",
    finishNote:
      "Установщик отключен в /etc/bdm/bdm.env. Перезапустите API, чтобы применить.",
    finishHideInstallerHint:
      "Чтобы полностью скрыть мастер, выполните: mv frontend/src/app/install frontend/src/app/_install.disabled",
    finishRestartHint: "Если мастер всё ещё виден, перезапустите API.",
    finishDisableFailed:
      "Установщик не удалось отключить автоматически. Установите INSTALLER_ENABLED=0 в /etc/bdm/bdm.env и перезапустите API.",
    finishCta: "Перейти на сайт",
    statusLabel: "Статус",
    messages: {
      configSaved: "Конфигурация сохранена в /etc/bdm.",
      systemSetupDone: "Системная установка завершена.",
      installFinished: "Установка завершена. Можно перейти на сайт.",
    },
    errors: {
      statusFailed: "Не удалось получить статус",
      configSaveFailed: "Не удалось сохранить конфигурацию",
      dbCheckFailed: "Проверка логина БД не удалась",
      hostChecksFailed: "Проверка хостов не удалась",
      systemSetupFailed: "Системная установка не удалась",
      installFailed: "Установка не выполнена",
    },
  },
};

const STORAGE_KEY = "bdmInstallerState";
const STORAGE_VERSION = 1;

function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-base-50 text-sm font-semibold">
        {step}
      </div>
      <div>
        <h3 className="font-display text-2xl text-ink-900">{title}</h3>
        <p className="mt-1 text-sm text-ink-600">{subtitle}</p>
      </div>
    </div>
  );
}

export default function InstallPage() {
  const [lang, setLang] = useState<"ru" | "en">(() =>
    typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ru")
      ? "ru"
      : "en",
  );
  const t = copy[lang];
  const totalSteps = 8;
  const [currentStep, setCurrentStep] = useState<number>(0);

  const [token, setToken] = useState("");
  const [status, setStatus] = useState<InstallerStatus | null>(null);
  const [statusTs, setStatusTs] = useState(0);
  const [hostChecks, setHostChecks] = useState<HostCheckResult[]>([]);
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configSaveNeedsPermissions, setConfigSaveNeedsPermissions] = useState(false);
  const [admin, setAdmin] = useState({
    username: "@admin",
    password: "",
    role: "admin",
  });
  const [seedUpsert, setSeedUpsert] = useState(true);
  const [installResult, setInstallResult] = useState<InstallResult | null>(null);
  const [installCompleted, setInstallCompleted] = useState(false);
  const [disableInstallerFailed, setDisableInstallerFailed] = useState(false);
  const [systemSetupResult, setSystemSetupResult] = useState<SystemSetupResult | null>(null);
  const [dbCheckResult, setDbCheckResult] = useState<DbCheckResult | null>(null);
  const [installNode, setInstallNode] = useState(true);
  const [installRedis, setInstallRedis] = useState(true);
  const [useNodesource, setUseNodesource] = useState(true);
  const [buildFrontend, setBuildFrontend] = useState(true);
  const [setupSystemd, setSetupSystemd] = useState(true);
  const [startServices, setStartServices] = useState(true);
  const [stateLoaded, setStateLoaded] = useState(false);

  const [config, setConfig] = useState<InstallerConfig>({
    baseUrl: "https://bd-bdm.myrkey.ru",
    dbHost: "192.168.20.6",
    dbPort: 3306,
    dbName: "bdm_kb",
    dbUser: "bdm_app",
    dbPassword: "",
    redisUrl: "redis://127.0.0.1:6379/0",
    jwtSecret: "",
    telegramBotToken: "",
    backendBaseUrl: "http://127.0.0.1:8000",
    apiBase: "/api",
    apiInternal: "http://127.0.0.1:8000",
  });

  const updateConfig = (patch: Partial<InstallerConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setConfigSaved(false);
    setHostChecks([]);
    setDbCheckResult(null);
  };

  useEffect(() => {
    document.body.classList.add("install-mode");
    return () => {
      document.body.classList.remove("install-mode");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStateLoaded(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<InstallerPersistedState>;
      if (parsed.version !== STORAGE_VERSION) {
        window.localStorage.removeItem(STORAGE_KEY);
        setStateLoaded(true);
        return;
      }
      if (parsed.lang === "ru" || parsed.lang === "en") {
        setLang(parsed.lang);
      }
      if (typeof parsed.currentStep === "number") {
        const safeStep = Math.min(Math.max(parsed.currentStep, 0), totalSteps - 1);
        setCurrentStep(safeStep);
      }
      if (typeof parsed.token === "string") {
        setToken(parsed.token);
      }
      const configCandidate = parsed.config;
      if (configCandidate) {
        setConfig((prev) => ({
          ...prev,
          ...configCandidate,
          dbPort: Number(configCandidate.dbPort ?? prev.dbPort),
        }));
      }
      if (parsed.admin) {
        setAdmin((prev) => ({ ...prev, ...parsed.admin }));
      }
      if (typeof parsed.seedUpsert === "boolean") {
        setSeedUpsert(parsed.seedUpsert);
      }
      if (typeof parsed.configSaved === "boolean") {
        setConfigSaved(parsed.configSaved);
      }
      if (Array.isArray(parsed.hostChecks)) {
        setHostChecks(parsed.hostChecks);
      }
      if ("dbCheckResult" in parsed) {
        setDbCheckResult(parsed.dbCheckResult ?? null);
      }
      if ("systemSetupResult" in parsed) {
        setSystemSetupResult(parsed.systemSetupResult ?? null);
      }
      if ("installResult" in parsed) {
        setInstallResult(parsed.installResult ?? null);
      }
      if (typeof parsed.installCompleted === "boolean") {
        setInstallCompleted(parsed.installCompleted);
      }
      if (typeof parsed.installNode === "boolean") {
        setInstallNode(parsed.installNode);
      }
      if (typeof parsed.installRedis === "boolean") {
        setInstallRedis(parsed.installRedis);
      }
      if (typeof parsed.useNodesource === "boolean") {
        setUseNodesource(parsed.useNodesource);
      }
      if (typeof parsed.buildFrontend === "boolean") {
        setBuildFrontend(parsed.buildFrontend);
      }
      if (typeof parsed.setupSystemd === "boolean") {
        setSetupSystemd(parsed.setupSystemd);
      }
      if (typeof parsed.startServices === "boolean") {
        setStartServices(parsed.startServices);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setStateLoaded(true);
    }
  }, [totalSteps]);

  useEffect(() => {
    if (!stateLoaded || typeof window === "undefined") return;
    const payload: InstallerPersistedState = {
      version: STORAGE_VERSION,
      lang,
      currentStep,
      token,
      config,
      admin,
      seedUpsert,
      configSaved,
      hostChecks,
      dbCheckResult,
      systemSetupResult,
      installResult,
      installCompleted,
      installNode,
      installRedis,
      useNodesource,
      buildFrontend,
      setupSystemd,
      startServices,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    stateLoaded,
    lang,
    currentStep,
    token,
    config,
    admin,
    seedUpsert,
    configSaved,
    hostChecks,
    dbCheckResult,
    systemSetupResult,
    installResult,
    installCompleted,
    installNode,
    installRedis,
    useNodesource,
    buildFrontend,
    setupSystemd,
    startServices,
  ]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 5000);
    return () => clearTimeout(timer);
  }, [status, statusTs]);
  useEffect(() => {
    setMessage(null);
  }, [currentStep]);

  const backendEnv = useMemo(
    () =>
      [
        "APP_ENV=production",
        `BASE_URL=${config.baseUrl}`,
        "",
        `DB_HOST=${config.dbHost}`,
        `DB_PORT=${config.dbPort}`,
        `DB_NAME=${config.dbName}`,
        `DB_USER=${config.dbUser}`,
        `DB_PASSWORD=${config.dbPassword || "CHANGE_ME"}`,
        "",
        `REDIS_URL=${config.redisUrl}`,
        "",
        `JWT_SECRET=${config.jwtSecret || "CHANGE_ME"}`,
        "JWT_ACCESS_TTL_MIN=15",
        "JWT_REFRESH_TTL_DAYS=30",
        "",
        `TELEGRAM_BOT_TOKEN=${config.telegramBotToken || "CHANGE_ME"}`,
        "",
        "TG_CONFIRM_CODE_TTL_MIN=10",
        "TG_CONFIRM_MAX_ATTEMPTS=5",
        "",
        `BACKEND_BASE_URL=${config.backendBaseUrl}`,
        "",
        "INSTALLER_ENABLED=1",
        `INSTALLER_TOKEN=${token || "CHANGE_ME_INSTALL_TOKEN"}`,
      ].join("\n"),
    [config, token],
  );

  const frontendEnv = useMemo(
    () =>
      [
        `NEXT_PUBLIC_API_BASE=${config.apiBase}`,
        `API_INTERNAL_URL=${config.apiInternal}`,
        `API_PROXY_URL=${config.apiInternal}`,
      ].join("\n"),
    [config],
  );

  const downloadFile = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const installerFetch = async <T,>(path: string, options: RequestInit = {}) =>
    apiFetch<T>(path, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        "X-Installer-Token": token,
      },
    });

  const handleStatus = async () => {
    setMessage(null);
    setLoading(true);
    const { data, error, response } = await installerFetch<InstallerStatus>("/install/status");
    setLoading(false);
    if (!response.ok || !data) {
      setMessage(error?.detail ?? t.errors.statusFailed);
      return;
    }
    setStatus(data);
    setStatusTs(Date.now());
  };

  const handleBootstrapCheck = async () => {
    setMessage(null);
    setLoading(true);
    const { data, error, response } = await installerFetch<BootstrapStatus>(
      "/install/bootstrap-status",
    );
    setLoading(false);
    if (!response.ok || !data) {
      setMessage(error?.detail ?? t.errors.statusFailed);
      return;
    }
    setBootstrapStatus(data);
  };

  const handleSaveConfig = async (): Promise<"ok" | "permission" | "error"> => {
    setMessage(null);
    setLoading(true);
    const { error, response } = await installerFetch("/install/env", {
      method: "POST",
      body: JSON.stringify({
        backend_env: backendEnv,
        frontend_env: frontendEnv,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const detail = error?.detail ?? t.errors.configSaveFailed;
      const permissionDenied =
        typeof detail === "string" &&
        (detail.includes("Permission denied") || detail.includes("Errno 13"));
      setConfigSaveNeedsPermissions(permissionDenied);
      setMessage(detail || t.errors.configSaveFailed);
      return permissionDenied ? "permission" : "error";
    }
    setConfigSaved(true);
    setConfigSaveNeedsPermissions(false);
    setMessage(t.messages.configSaved);
    return "ok";
  };

  const handleDbCheck = async () => {
    setMessage(null);
    setLoading(true);
    const { data, error, response } = await installerFetch<DbCheckResult>("/install/db-check", {
      method: "POST",
      body: JSON.stringify({ backend_env: backendEnv }),
    });
    setLoading(false);
    if (!response.ok || !data) {
      setMessage(error?.detail ?? t.errors.dbCheckFailed);
      return;
    }
    setDbCheckResult(data);
    if (data.db_ok) {
      setMessage(t.dbCheckOk);
    } else {
      setMessage(data.error ?? t.errors.dbCheckFailed);
    }
  };
  const handleHostChecks = async (): Promise<boolean> => {
    setMessage(null);
    setLoading(true);
    let redisHost = "127.0.0.1";
    let redisPort = 6379;
    try {
      const redisUrl = new URL(config.redisUrl);
      if (redisUrl.hostname) {
        redisHost = redisUrl.hostname;
      }
      if (redisUrl.port) {
        redisPort = Number(redisUrl.port);
      }
    } catch (error) {
      setLoading(false);
      setMessage(t.errors.hostChecksFailed);
      return false;
    }

    const payload = {
      items: [
        { name: "database", host: config.dbHost, port: config.dbPort },
        { name: "redis", host: redisHost, port: redisPort },
      ],
    };
    const { data, error, response } = await installerFetch<{ results: HostCheckResult[] }>(
      "/install/hosts-check",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    setLoading(false);
    if (!response.ok || !data) {
      setMessage(error?.detail ?? t.errors.hostChecksFailed);
      return false;
    }
    setHostChecks(data.results);
    return data.results.every((item) => item.ok);
  };

  const handleSystemSetup = async () => {
    setMessage(null);
    setLoading(true);
    const { data, error, response } = await installerFetch<SystemSetupResult>("/install/system-setup", {
      method: "POST",
      body: JSON.stringify({
        install_node: installNode,
        install_redis: installRedis,
        use_nodesource: useNodesource,
        build_frontend: buildFrontend,
        setup_systemd: setupSystemd,
        start_services: startServices,
      }),
    });
    setLoading(false);
    if (!response.ok || !data) {
      setMessage(error?.detail ?? t.errors.systemSetupFailed);
      return;
    }
    setSystemSetupResult(data);
    setMessage(data.status === "ok" ? t.messages.systemSetupDone : t.errors.systemSetupFailed);
  };

  const handleInstall = async (): Promise<boolean> => {
    setMessage(null);
    setDisableInstallerFailed(false);
    setLoading(true);
    const { data, error, response } = await installerFetch<InstallResult>("/install/one-click", {
      method: "POST",
      body: JSON.stringify({
        admin,
        seed: true,
        seed_upsert: seedUpsert,
        finish: true,
        disable_installer: true,
        backend_env: backendEnv,
      }),
    });
    setLoading(false);
    if (!response.ok || !data) {
      setMessage(error?.detail ?? t.errors.installFailed);
      return false;
    }
    setInstallResult(data);
    const disableFailed = data.steps.some(
      (step) => step.step === "disable_installer" && step.status !== "ok",
    );
    setDisableInstallerFailed(disableFailed);
    if (data.status === "ok") {
      setInstallCompleted(true);
      setMessage(t.messages.installFinished);
      return true;
    }
    setMessage(t.errors.installFailed);
    return false;
  };

  const stepProgress = t.progressLabel(currentStep + 1, totalSteps);
  const goNext = () => setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
  const goPrev = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const isTokenValid = token.trim().length > 0;
  const isConfigValid =
    config.baseUrl.trim().length > 0 &&
    config.dbHost.trim().length > 0 &&
    Number.isFinite(config.dbPort) &&
    config.dbPort > 0 &&
    config.dbName.trim().length > 0 &&
    config.dbUser.trim().length > 0 &&
    config.dbPassword.trim().length > 0 &&
    config.redisUrl.trim().length > 0 &&
    config.jwtSecret.trim().length > 0 &&
    config.telegramBotToken.trim().length > 0 &&
    config.backendBaseUrl.trim().length > 0 &&
    config.apiBase.trim().length > 0 &&
    config.apiInternal.trim().length > 0;

  const hostChecksOk = hostChecks.length > 0 && hostChecks.every((item) => item.ok);
  const isAdminValid = admin.username.trim().length > 0 && admin.password.length >= 8;
  const adminStep = installResult?.steps.find((step) => step.step === "admin");

  const stepValid = (() => {
    switch (currentStep) {
      case 0:
        return true;
      case 1:
        return true;
      case 2:
        return isTokenValid;
      case 3:
        return isConfigValid && isTokenValid;
      case 4:
        return true;
      case 5:
        return isAdminValid && configSaved && hostChecksOk;
      case 6:
        return installCompleted;
      default:
        return true;
    }
  })();

  const canGoPrev = currentStep > 0;
  const canGoNext = currentStep < totalSteps - 1 && stepValid && !loading;
  const messageNode = message ? <p className="mt-4 text-sm text-accent-600">{message}</p> : null;
  const sudoRequired = systemSetupResult?.output?.includes("sudo: a password is required") ?? false;
  const showBootstrapHint = configSaveNeedsPermissions || sudoRequired;

  const bootstrapCommandBlock = (
    <div className="mt-4 rounded-2xl border border-ink-900/10 bg-white/80 p-4 text-sm text-ink-700">
      <p className="font-semibold text-ink-900">{t.bootstrapTitle}</p>
      <p className="mt-1 text-xs text-ink-500">{t.bootstrapDescription}</p>
      <pre className="mt-3 overflow-auto rounded-xl bg-ink-900/5 p-3 text-xs">
        {t.bootstrapCommand}
      </pre>
    </div>
  );
  const bootstrapBlock = showBootstrapHint ? bootstrapCommandBlock : null;

  const handleNext = async () => {
    if (currentStep === 3 && isConfigValid && !configSaved) {
      const result = await handleSaveConfig();
      if (result === "error") return;
    }
    if (currentStep === 4 && !hostChecksOk) {
      const ok = await handleHostChecks();
      if (!ok) return;
    }
    if (currentStep === 5 && !installCompleted) {
      const ok = await handleInstall();
      if (!ok) return;
    }
    goNext();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {currentStep === 0 && (
        <Card className="animate-in">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-500">{stepProgress}</p>
          <div className="mt-3">
            <StepHeader step="01" title={t.step0Title} subtitle={t.step0Subtitle} />
          </div>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl text-ink-900">{t.title}</h2>
              <p className="mt-2 text-sm text-ink-600">{t.intro}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ink-600">
                {t.languageLabel}
              </span>
              <div className="flex rounded-full border border-ink-900/10 bg-white/80 p-1">
                {([
                  { key: "ru", label: "RU" },
                  { key: "en", label: "EN" },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setLang(item.key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      lang === item.key
                        ? "bg-ink-900 text-base-50"
                        : "text-ink-700 hover:bg-ink-900/10"
                    }`}
                    aria-pressed={lang === item.key}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <Button onClick={handleNext} disabled={!canGoNext}>
              {t.nextStep}
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 1 && (
        <Card className="animate-in">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-500">{stepProgress}</p>
          <div className="mt-3">
            <StepHeader step="02" title={t.bootstrapStepTitle} subtitle={t.bootstrapStepSubtitle} />
          </div>
          <p className="mt-2 text-xs text-ink-500">{t.bootstrapNote}</p>
          {bootstrapCommandBlock}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={handleBootstrapCheck} disabled={loading} title={t.checkStatusHint}>
              {t.bootstrapCheckButton}
            </Button>
          </div>
          {bootstrapStatus && (
            <div className="mt-4 rounded-2xl border border-ink-900/10 bg-white/80 p-4 text-sm text-ink-700">
              <p className="font-semibold text-ink-900">{t.bootstrapStatusTitle}</p>
              <p className="mt-1 text-xs text-ink-500">{t.bootstrapStatusHint}</p>
              <ul className="mt-3 space-y-1">
                <li>
                  {t.bootstrapEnvDir}: {bootstrapStatus.env_dir_writable ? t.bootstrapOk : t.bootstrapFail}
                </li>
                <li>
                  {t.bootstrapSudoers}: {bootstrapStatus.sudoers_present ? t.bootstrapOk : t.bootstrapFail}
                </li>
                <li>
                  {t.bootstrapScript}: {bootstrapStatus.system_install_exists ? t.bootstrapOk : t.bootstrapFail}
                </li>
              </ul>
            </div>
          )}
          {messageNode}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={goPrev} disabled={!canGoPrev}>
              {t.prevStep}
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext}>
              {t.nextStep}
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 2 && (
        <Card className="animate-in">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-500">{stepProgress}</p>
          <div className="mt-3">
            <StepHeader step="03" title={t.step1Title} subtitle={t.step1Subtitle} />
          </div>
          <div className="mt-6 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-600">
              {t.tokenLabel} *
            </label>
            <Input
              type="password"
              placeholder="INSTALLER_TOKEN *"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleStatus} disabled={loading || !token} title={t.checkStatusHint}>
                {t.checkStatus}
              </Button>
            </div>
            {status && (
              <p className="text-sm text-ink-600 fade-out" key={`status-${statusTs}`}>
                {t.statusLine(status)}
              </p>
            )}
            {status && !status.enabled && (
              <p className="text-sm text-red-700">{t.installerDisabledHint}</p>
            )}
            {messageNode}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={goPrev} disabled={!canGoPrev}>
              {t.prevStep}
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext}>
              {t.nextStep}
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 3 && (
        <Card className="animate-in">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-500">{stepProgress}</p>
          <div className="mt-3">
            <StepHeader step="04" title={t.step2Title} subtitle={t.step2Subtitle} />
          </div>
          <p className="mt-2 text-xs text-ink-500">{t.step2Note}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Input
                placeholder="BASE_URL *"
                value={config.baseUrl}
                onChange={(event) => updateConfig({ baseUrl: event.target.value })}
              />
              <Input
                placeholder="DB_HOST *"
                value={config.dbHost}
                onChange={(event) => updateConfig({ dbHost: event.target.value })}
              />
              <Input
                placeholder="DB_PORT *"
                type="number"
                value={config.dbPort}
                onChange={(event) => updateConfig({ dbPort: Number(event.target.value) })}
              />
              <Input
                placeholder="DB_NAME *"
                value={config.dbName}
                onChange={(event) => updateConfig({ dbName: event.target.value })}
              />
              <Input
                placeholder="DB_USER *"
                value={config.dbUser}
                onChange={(event) => updateConfig({ dbUser: event.target.value })}
              />
              <Input
                placeholder="DB_PASSWORD *"
                type="password"
                value={config.dbPassword}
                onChange={(event) => updateConfig({ dbPassword: event.target.value })}
              />
              <Input
                placeholder="REDIS_URL *"
                value={config.redisUrl}
                onChange={(event) => updateConfig({ redisUrl: event.target.value })}
              />
              <Input
                placeholder="JWT_SECRET *"
                value={config.jwtSecret}
                onChange={(event) => updateConfig({ jwtSecret: event.target.value })}
              />
              <Input
                placeholder="TELEGRAM_BOT_TOKEN *"
                type="password"
                value={config.telegramBotToken}
                onChange={(event) => updateConfig({ telegramBotToken: event.target.value })}
              />
              <Input
                placeholder="BACKEND_BASE_URL *"
                value={config.backendBaseUrl}
                onChange={(event) => updateConfig({ backendBaseUrl: event.target.value })}
              />
            </div>
            <div className="space-y-3">
              <Input
                placeholder="NEXT_PUBLIC_API_BASE *"
                value={config.apiBase}
                onChange={(event) => updateConfig({ apiBase: event.target.value })}
              />
              <Input
                placeholder="API_INTERNAL_URL *"
                value={config.apiInternal}
                onChange={(event) => updateConfig({ apiInternal: event.target.value })}
              />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-600">
                  {t.backendEnvLabel}
                </p>
                <textarea
                  className="h-48 w-full rounded-2xl border border-ink-900/10 bg-white/80 p-3 text-xs"
                  readOnly
                  value={backendEnv}
                />
                <Button variant="ghost" onClick={() => downloadFile("bdm.env", backendEnv)}>
                  {t.downloadBackendEnv}
                </Button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-600">
                  {t.frontendEnvLabel}
                </p>
                <textarea
                  className="h-32 w-full rounded-2xl border border-ink-900/10 bg-white/80 p-3 text-xs"
                  readOnly
                  value={frontendEnv}
                />
                <Button variant="ghost" onClick={() => downloadFile("frontend.env", frontendEnv)}>
                  {t.downloadFrontendEnv}
                </Button>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={handleSaveConfig}
                  disabled={loading || !token || !isConfigValid}
                  title={t.saveConfigHint}
                >
                  {t.saveConfig}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDbCheck}
                  disabled={loading || !token || !isConfigValid}
                  title={t.dbCheckHint}
                >
                  {t.dbCheckButton}
                </Button>
                {dbCheckResult && (
                  <p className={`text-xs ${dbCheckResult.db_ok ? "text-ink-500" : "text-red-700"}`}>
                    {dbCheckResult.db_ok ? t.dbCheckOk : dbCheckResult.error}
                  </p>
                )}
                {configSaved && <p className="text-xs text-ink-500">{t.messages.configSaved}</p>}
                {!configSaved && configSaveNeedsPermissions && (
                  <p className="text-xs text-red-700">{t.configSavePermissionHint}</p>
                )}
                {configSaveNeedsPermissions && bootstrapBlock}
              </div>
            </div>
          </div>
          {messageNode}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={goPrev} disabled={!canGoPrev}>
              {t.prevStep}
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext}>
              {t.nextStep}
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 4 && (
        <Card className="animate-in">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-500">{stepProgress}</p>
          <div className="mt-3">
            <StepHeader step="05" title={t.step3Title} subtitle={t.step3Subtitle} />
          </div>
          <p className="mt-2 text-xs text-ink-500">{t.step3Note}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={handleHostChecks}
              disabled={loading || !token || !isConfigValid}
              title={t.hostChecksHint}
            >
              {t.runHostChecks}
            </Button>
          </div>
          {hostChecks.length > 0 && (
            <div className="mt-4 space-y-2 text-sm text-ink-700">
              {hostChecks.map((item) => (
                <div
                  key={`${item.name}-${item.host}-${item.port}`}
                  className="rounded-2xl border border-ink-900/10 bg-white/80 p-3"
                >
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-ink-500">
                    {item.host}:{item.port} — {item.ok ? t.hostOk : t.hostFail}
                  </p>
                  {!item.ok && item.error && (
                    <p className="mt-1 text-xs text-red-700">{item.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 rounded-2xl border border-ink-900/10 bg-white/80 p-4">
            <p className="font-semibold text-ink-900">{t.systemSetupTitle}</p>
            <p className="mt-1 text-xs text-ink-500">{t.systemSetupSubtitle}</p>
            <div className="mt-3 grid gap-2 text-sm text-ink-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={installNode}
                  onChange={(event) => setInstallNode(event.target.checked)}
                />
                {t.installNodeLabel}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={installRedis}
                  onChange={(event) => setInstallRedis(event.target.checked)}
                />
                {t.installRedisLabel}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useNodesource}
                  onChange={(event) => setUseNodesource(event.target.checked)}
                />
                {t.useNodesourceLabel}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={buildFrontend}
                  onChange={(event) => setBuildFrontend(event.target.checked)}
                />
                {t.buildFrontendLabel}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={setupSystemd}
                  onChange={(event) => setSetupSystemd(event.target.checked)}
                />
                {t.setupSystemdLabel}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={startServices}
                  onChange={(event) => setStartServices(event.target.checked)}
                />
                {t.startServicesLabel}
              </label>
            </div>
            <Button className="mt-3" onClick={handleSystemSetup} disabled={loading || !token}>
              {t.runSystemSetup}
            </Button>
            {systemSetupResult && (
              <div className="mt-3 rounded-2xl border border-ink-900/10 bg-white/80 p-3 text-sm text-ink-700">
                <p className="font-semibold">
                  {t.statusLabel}: {systemSetupResult.status}
                </p>
                {systemSetupResult.output && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-ink-900/5 p-3 text-xs">
                    {systemSetupResult.output}
                  </pre>
                )}
              </div>
            )}
            {sudoRequired && bootstrapBlock}
          </div>
          {messageNode}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={goPrev} disabled={!canGoPrev}>
              {t.prevStep}
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext}>
              {t.nextStep}
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 5 && (
        <Card className="animate-in">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-500">{stepProgress}</p>
          <div className="mt-3">
            <StepHeader step="06" title={t.step5Title} subtitle={t.step5Subtitle} />
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-ink-900/10 bg-white/80 p-4">
              <p className="font-semibold text-ink-900">{t.adminFormTitle}</p>
              <p className="mt-1 text-xs text-ink-500">{t.adminFormSubtitle}</p>
              <div className="mt-3 space-y-3">
                <Input
                  placeholder="@admin *"
                  value={admin.username}
                  onChange={(event) => setAdmin({ ...admin, username: event.target.value })}
                />
                <Input
                  placeholder={`${t.passwordPlaceholder} *`}
                  type="password"
                  value={admin.password}
                  onChange={(event) => setAdmin({ ...admin, password: event.target.value })}
                />
                <Input
                  placeholder={t.rolePlaceholder}
                  value={admin.role}
                  onChange={(event) => setAdmin({ ...admin, role: event.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-ink-500">{t.installNote}</p>
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={seedUpsert}
                onChange={(event) => setSeedUpsert(event.target.checked)}
              />
              {t.upsertSeedLabel}
            </label>
            <Button
              onClick={handleInstall}
              disabled={loading || !token || !isAdminValid || !configSaved || !hostChecksOk}
              title={t.step5Subtitle}
            >
              {t.runInstall}
            </Button>
            {installResult && (
              <div className="rounded-2xl border border-ink-900/10 bg-white/80 p-3 text-sm text-ink-700">
                <p className="font-semibold">
                  {t.statusLabel}: {installResult.status}
                </p>
                <ul className="mt-2 space-y-1">
                  {installResult.steps.map((step) => (
                    <li key={`install-${step.step}`}>
                      {step.step}: {step.status}
                      {step.detail ? ` (${step.detail})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {messageNode}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={goPrev} disabled={!canGoPrev}>
              {t.prevStep}
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext}>
              {t.nextStep}
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 6 && (
        <Card className="animate-in">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-500">{stepProgress}</p>
          <div className="mt-3">
            <StepHeader step="07" title={t.step4Title} subtitle={t.step4Subtitle} />
          </div>
          <div className="mt-4 rounded-2xl border border-ink-900/10 bg-white/80 p-4 text-sm text-ink-700">
            {adminStep ? (
              <p className="font-semibold text-ink-900">
                {t.statusLabel}: {adminStep.status}
              </p>
            ) : (
              <p className="text-xs text-ink-500">{t.adminReviewEmpty}</p>
            )}
          </div>
          {messageNode}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" onClick={goPrev} disabled={!canGoPrev}>
              {t.prevStep}
            </Button>
            <Button onClick={handleNext} disabled={!canGoNext}>
              {t.nextStep}
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 7 && (
        <Card className="animate-in">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-500">{stepProgress}</p>
          <div className="mt-3">
            <StepHeader step="08" title={t.step6Title} subtitle={t.step6Subtitle} />
          </div>
          <div className="mt-4 rounded-2xl border border-ink-900/10 bg-white/80 p-4 text-sm text-ink-700">
            <p className="font-semibold text-ink-900">{t.messages.installFinished}</p>
            {disableInstallerFailed ? (
              <p className="mt-2 text-xs text-red-700">{t.finishDisableFailed}</p>
            ) : (
              <p className="mt-2 text-xs text-ink-500">{t.finishNote}</p>
            )}
            <p className="mt-2 text-xs text-ink-500">{t.finishHideInstallerHint}</p>
            <p className="mt-2 text-xs text-ink-500">{t.finishRestartHint}</p>
            <Button className="mt-4" onClick={() => (window.location.href = "/")}>
              {t.finishCta}
            </Button>
          </div>
          {messageNode}
        </Card>
      )}
    </div>
  );
}
