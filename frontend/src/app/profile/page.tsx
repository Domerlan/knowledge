"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiFetch } from "@/lib/api";

type User = {
  id: string;
  username: string;
  role: string;
  telegram_id?: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("profile-mode");
    document.documentElement.classList.add("profile-mode");
    return () => {
      document.body.classList.remove("profile-mode");
      document.documentElement.classList.remove("profile-mode");
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data, error: apiError, response } = await apiFetch<User>("/auth/me");
      if (!response.ok || !data) {
        setError(apiError?.detail ?? "Сессия недоступна. Войдите снова.");
        setLoading(false);
        return;
      }
      setUser(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    router.push("/auth/login");
  };

  const roleLabel = useMemo(() => {
    if (!user) return "Гость";
    if (user.role === "admin") return "Администратор";
    if (user.role === "moderator") return "Модератор";
    return "Пользователь";
  }, [user]);

  const initials = useMemo(() => {
    if (!user?.username) return "BD";
    return user.username.replace("@", "").slice(0, 2).toUpperCase();
  }, [user]);

  return (
    <div className="profile-shell">
      <div className="profile-card animate-in">
        <div className="profile-header">
          <div className="profile-avatar">{initials}</div>
          <div>
            <p className="profile-kicker">Профиль</p>
            <h2 className="profile-title">{user?.username ?? "Участник"}</h2>
            <div className="profile-meta">
              <span className="profile-badge">{roleLabel}</span>
              <span className="profile-status">
                {loading ? "Загрузка..." : error ? "Сессия недоступна" : "Аккаунт активен"}
              </span>
            </div>
          </div>
        </div>

        {error && <p className="profile-error">{error}</p>}

        <div className="profile-grid">
          <div className="profile-panel">
            <p className="profile-label">Аккаунт</p>
            <div className="profile-field">
              <span className="profile-field-label">Username</span>
              <span className="profile-field-value">{user?.username ?? "—"}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">User ID</span>
              <span className="profile-field-value">{user?.id ?? "—"}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Роль</span>
              <span className="profile-field-value">{roleLabel}</span>
            </div>
          </div>

          <div className="profile-panel">
            <p className="profile-label">Telegram</p>
            <div className="profile-field">
              <span className="profile-field-label">Статус</span>
              <span className="profile-field-value">
                {user?.telegram_id ? "Привязан" : "Не привязан"}
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">ID</span>
              <span className="profile-field-value">{user?.telegram_id ?? "—"}</span>
            </div>
            <p className="profile-hint">
              Подтверждение Telegram происходит при регистрации через бота.
            </p>
          </div>

          <div className="profile-panel">
            <p className="profile-label">Безопасность</p>
            <div className="profile-field">
              <span className="profile-field-label">Сессия</span>
              <span className="profile-field-value">Активна · cookies HttpOnly</span>
            </div>
            <div className="profile-field">
              <span className="profile-field-label">Доступ</span>
              <span className="profile-field-value">Требуется повторный вход через 30 дней</span>
            </div>
            <p className="profile-hint">
              Если потеряли доступ к Telegram, обратитесь к администратору.
            </p>
          </div>
        </div>

        <div className="profile-actions">
          <button className="profile-logout" onClick={handleLogout}>
            Выйти
          </button>
          <Link className="profile-link" href="/">
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
