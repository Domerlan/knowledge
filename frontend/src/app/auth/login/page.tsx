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
import { loginSchema } from "@/lib/validators";

type LoginForm = z.infer<typeof loginSchema>;

type AuthResponse = {
  user: {
    id: string;
    username: string;
    role: string;
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    document.body.classList.add("login-mode");
    document.documentElement.classList.add("login-mode");
    return () => {
      document.body.classList.remove("login-mode");
      document.documentElement.classList.remove("login-mode");
    };
  }, []);

  const onSubmit = async (values: LoginForm) => {
    setError(null);
    setLoading(true);
    const { data, error: apiError, response } = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(values),
    });
    setLoading(false);

    if (!response.ok || !data) {
      setError(apiError?.detail ?? "Login failed");
      return;
    }

    router.push("/profile");
  };

  return (
    <div className="auth-shell">
      <div className="auth-card animate-in">
        <p className="text-xs uppercase tracking-[0.4em] text-base-50/70">BDM Knowledge</p>
        <h2 className="mt-3 font-display text-4xl text-base-50">Авторизация</h2>
        <p className="mt-2 text-sm text-base-50/75">Войдите, чтобы продолжить.</p>
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
            {form.formState.errors.username && (
              <p className="text-xs text-amber-300/90">Неверный формат username</p>
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
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-base-50/40 bg-ink-900/40"
              />
              Запомнить меня
            </label>
            <Link href="/auth/register" className="text-base-50/70 hover:text-base-50">
              Нет аккаунта?
            </Link>
          </div>
          {error && <p className="text-sm text-amber-300/90">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full auth-primary">
            {loading ? "Входим..." : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
}
