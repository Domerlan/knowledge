"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { registerSchema } from "@/lib/validators";

type RegisterForm = z.infer<typeof registerSchema>;

type RegisterResponse = {
  status: string;
  code: string;
  expires_at: string;
};

type RegisterStatusResponse = {
  status: string;
};

type AuthResponse = {
  user: {
    id: string;
    username: string;
    role: string;
  };
};

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<RegisterForm | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const telegramBotUrl = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL ?? "https://t.me/YourBot";

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    document.body.classList.add("register-mode");
    document.documentElement.classList.add("register-mode");
    return () => {
      document.body.classList.remove("register-mode");
      document.documentElement.classList.remove("register-mode");
    };
  }, []);

  const onSubmit = async (values: RegisterForm) => {
    setError(null);
    setStatusMessage(null);
    setLoading(true);
    const { data, error: apiError, response } = await apiFetch<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(values),
    });
    setLoading(false);

    if (!response.ok || !data) {
      setError(apiError?.detail ?? "Registration failed");
      return;
    }

    setPendingCredentials(values);
    setCode(data.code);
    setExpiresAt(data.expires_at);
    setStatusMessage("Ожидаем подтверждения в Telegram...");
  };

  useEffect(() => {
    if (!code || !pendingCredentials) return;
    let active = true;
    const interval = setInterval(async () => {
      const { data, error: apiError, response } = await apiFetch<RegisterStatusResponse>(
        "/auth/register/status",
        {
          method: "POST",
          body: JSON.stringify({ code }),
        },
      );
      if (!active) return;
      if (!response.ok || !data) {
        setError(apiError?.detail ?? "Не удалось проверить статус регистрации");
        return;
      }
      if (data.status === "approved") {
        setStatusMessage("Аккаунт подтверждён. Входим...");
        const { data: loginData, error: loginError, response: loginResponse } =
          await apiFetch<AuthResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify({
              username: pendingCredentials.username,
              password: pendingCredentials.password,
            }),
          });
        if (!loginResponse.ok || !loginData) {
          setError(loginError?.detail ?? "Не удалось войти автоматически");
          return;
        }
        router.push("/");
        return;
      }
      if (data.status === "rejected") {
        setError("Регистрация отклонена. Проверьте @username в Telegram.");
        setStatusMessage(null);
        clearInterval(interval);
      } else if (data.status === "expired") {
        setError("Код подтверждения истёк. Зарегистрируйтесь заново.");
        setStatusMessage(null);
        clearInterval(interval);
      }
    }, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [code, pendingCredentials, router]);

  return (
    <div className="auth-shell">
      <div className="auth-card animate-in">
        <p className="text-xs uppercase tracking-[0.4em] text-base-50/70">BDM Knowledge</p>
        <h2 className="mt-3 font-display text-4xl text-base-50">Регистрация</h2>
        <p className="mt-2 text-sm text-base-50/75">
          Создайте аккаунт и подтвердите его в Telegram.
        </p>
        <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-base-50/70">
              Username
            </label>
            <Input
              placeholder="@name"
              className="border-base-50/30 bg-base-50/90 text-ink-900 placeholder:text-ink-900/50 focus:border-base-50/60 focus:ring-base-50/30"
              {...form.register("username")}
            />
            <p className="text-xs text-base-50/75">
              Username должен совпадать с вашим Telegram @username.
            </p>
            {form.formState.errors.username && (
              <p className="text-xs text-amber-300/90">
                Используйте формат @name (буквы/цифры/_)
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-base-50/70">
              Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="password"
                className="border-base-50/30 bg-base-50/90 pr-12 text-ink-900 placeholder:text-ink-900/50 focus:border-base-50/60 focus:ring-base-50/30"
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-900/80 hover:text-ink-900"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.7 10.7a3 3 0 0 0 4.2 4.2" />
                    <path d="M9.88 5.09A10.53 10.53 0 0 1 12 5c5.05 0 9.27 3.1 11 7-0.59 1.33-1.42 2.54-2.41 3.57" />
                    <path d="M6.1 6.1C4.05 7.3 2.5 9.05 1 12c1.73 3.9 5.95 7 11 7 1.7 0 3.32-0.33 4.79-0.94" />
                  </svg>
                ) : (
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 12s4.2-7 11-7 11 7 11 7-4.2 7-11 7-11-7-11-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-xs text-amber-300/90">Пароль минимум 8 символов</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-base-50/70">
            <Link
              href={telegramBotUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-base-50/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-base-50/80 transition hover:bg-base-50 hover:text-ink-900"
            >
              Открыть бота
            </Link>
            <Link href="/auth/login" className="text-base-50/70 hover:text-base-50">
              Уже есть аккаунт?
            </Link>
          </div>
          <div className="rounded-2xl border border-base-50/15 bg-ink-900/35 px-4 py-3 text-xs text-base-50/70">
            <p className="text-base-50/85">Как проходит подтверждение:</p>
            <div className="mt-2 space-y-1 text-base-50/70">
              <p>После отправки формы сайт покажет код подтверждения.</p>
              <p>Откройте Telegram‑бота и отправьте ему этот код.</p>
              <p>После ответа бота произойдёт автоматический вход.</p>
            </div>
          </div>
          {error && <p className="text-sm text-amber-300/90">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full auth-primary">
            {loading ? "Создание..." : "Создать аккаунт"}
          </Button>
        </form>

        {code && (
          <div className="mt-6 rounded-2xl border border-base-50/20 bg-ink-900/40 p-4 text-base-50/80">
            <p className="text-xs uppercase tracking-[0.3em] text-base-50/70">Telegram</p>
            <p className="mt-2 text-sm text-base-50/80">
              Откройте бота и отправьте этот код подтверждения:
            </p>
            <p className="mt-3 rounded-full border border-base-50/30 bg-ink-900/50 px-4 py-2 text-center font-mono text-lg text-base-50">
              {code}
            </p>
            {expiresAt && (
              <p className="mt-3 text-xs text-base-50/60">
                Истекает: {new Date(expiresAt).toLocaleString()}
              </p>
            )}
            {statusMessage && <p className="mt-3 text-xs text-base-50/70">{statusMessage}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
