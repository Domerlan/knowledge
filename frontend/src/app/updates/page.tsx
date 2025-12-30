"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { apiFetch } from "@/lib/api";

type UpdateListItem = {
  id: string;
  title: string;
  patch_date: string;
};

type UpdateDetail = {
  id: string;
  title: string;
  patch_date: string;
  content: string;
};

type UpdateListOut = {
  items: UpdateListItem[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
};

export default function UpdatesPage() {
  const [items, setItems] = useState<UpdateListItem[]>([]);
  const [details, setDetails] = useState<Record<string, UpdateDetail>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add("updates-mode");
    document.documentElement.classList.add("updates-mode");
    return () => {
      document.body.classList.remove("updates-mode");
      document.documentElement.classList.remove("updates-mode");
    };
  }, []);

  const loadPage = async (targetPage: number, append = false) => {
    const { data, error: apiError } = await apiFetch<UpdateListOut>(
      `/updates?page=${targetPage}&per_page=6`,
    );
    if (!data) {
      setError(apiError?.detail ?? "Не удалось загрузить обновления.");
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    setItems((prev) => (append ? [...prev, ...data.items] : data.items));
    setHasMore(data.has_more);
    setPage(data.page);
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    loadPage(1);
  }, []);

  const toggleItem = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!details[id]) {
      const { data } = await apiFetch<UpdateDetail>(`/updates/${id}`);
      if (data) {
        setDetails((prev) => ({ ...prev, [id]: data }));
      }
    }
  };

  const formattedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        dateLabel: new Date(item.patch_date).toLocaleDateString("ru-RU", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      })),
    [items],
  );

  return (
    <div className="updates-shell">
      <header className="updates-header">
        <div>
          <p className="updates-kicker">BDM Knowledge</p>
          <h2 className="updates-title">Обновления игры</h2>
          <p className="updates-subtitle">
            Патчи и заметки выходят регулярно. Нажмите на строку, чтобы раскрыть детали.
          </p>
        </div>
        <Link href="/" className="updates-back">
          На главную
        </Link>
      </header>

      {error && <p className="updates-error">{error}</p>}

      <div className="updates-list" role="list">
        {loading && <p className="updates-empty">Загружаем обновления...</p>}
        {!loading && formattedItems.length === 0 && (
          <p className="updates-empty">Пока нет опубликованных обновлений.</p>
        )}
        {formattedItems.map((item, index) => {
          const isOpen = expandedId === item.id;
          const detail = details[item.id];
          return (
            <div key={item.id} className={`updates-item ${isOpen ? "is-open" : ""}`} role="listitem">
              <button
                className="updates-trigger"
                onClick={() => toggleItem(item.id)}
                aria-expanded={isOpen}
                aria-controls={`update-panel-${item.id}`}
                id={`update-trigger-${item.id}`}
                type="button"
              >
                <div className="updates-meta">
                  <span className="updates-date">{item.dateLabel}</span>
                  <span className="updates-name">{item.title}</span>
                </div>
                <span className="updates-icon" aria-hidden="true">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              <div
                id={`update-panel-${item.id}`}
                role="region"
                aria-labelledby={`update-trigger-${item.id}`}
                className="updates-panel"
                aria-hidden={!isOpen}
                style={{ maxHeight: isOpen ? "1200px" : "0px" }}
              >
                <div className="updates-content">
                  {!detail && <p className="updates-loading">Загружаем детали...</p>}
                  {detail && (
                    <div
                      className="updates-html"
                      dangerouslySetInnerHTML={{ __html: detail.content }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="updates-more">
          <button
            className="updates-more-btn"
            onClick={() => {
              setLoadingMore(true);
              loadPage(page + 1, true);
            }}
            disabled={loadingMore}
          >
            {loadingMore ? "Загружаем..." : "Показать ещё"}
          </button>
        </div>
      )}
    </div>
  );
}
