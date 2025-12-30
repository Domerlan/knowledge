"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { apiFetch } from "@/lib/api";

type Section = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
};

type Article = {
  id: string;
  title: string;
  slug: string;
  section_id: string;
  status: string;
};

export default function HomePage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("home-mode");
    document.documentElement.classList.add("home-mode");
    return () => {
      document.body.classList.remove("home-mode");
      document.documentElement.classList.remove("home-mode");
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      const [sectionsRes, articlesRes] = await Promise.all([
        apiFetch<Section[]>("/sections"),
        apiFetch<Article[]>("/articles"),
      ]);
      if (sectionsRes.data) setSections(sectionsRes.data);
      if (articlesRes.data) setArticles(articlesRes.data);
      setLoading(false);
    };
    load();
  }, []);

  const featuredSections = useMemo(() => sections.slice(0, 3), [sections]);
  const featuredArticles = useMemo(() => articles.slice(0, 3), [articles]);

  return (
    <div className="home-shell">
      <div className="home-topbar">
        <button className="home-tab">PvE Приключения</button>
        <button className="home-tab home-tab--active">
          PvP Битвы <span className="home-badge">1</span>
        </button>
        <button className="home-tab">Конечные Задания</button>
      </div>


      <section className="home-grid">
        <article className="home-card home-card--left animate-in">
          <p className="home-tag">Эпическое</p>
          <h3 className="home-card-title">Разделы знаний</h3>
          <p className="home-card-text">Откройте скрытые механики и редкие советы.</p>
          <div className="home-card-list">
            {loading ? (
              <span>Загружаем разделы...</span>
            ) : featuredSections.length === 0 ? (
              <span>Разделов пока нет.</span>
            ) : (
              featuredSections.map((section) => (
                <span key={section.id}>{section.title}</span>
              ))
            )}
          </div>
          <button className="home-cta">Открыть</button>
        </article>

        <article className="home-card home-card--center animate-in">
          <p className="home-tag">Ежедневные задания</p>
          <h3 className="home-card-title">Свежие статьи</h3>
          <p className="home-card-text">Новые заметки команды и находки сообщества.</p>
          <div className="home-card-list">
            {loading ? (
              <span>Загружаем статьи...</span>
            ) : featuredArticles.length === 0 ? (
              <span>Статей пока нет.</span>
            ) : (
              featuredArticles.map((article) => (
                <span key={article.id}>{article.title}</span>
              ))
            )}
          </div>
          <button className="home-cta">Показать</button>
        </article>

        <article className="home-card home-card--right animate-in">
          <p className="home-tag">Легендарный</p>
          <h3 className="home-card-title">Мифический квест</h3>
          <p className="home-card-text">Пошаговые гайды по ключевым событиям.</p>
          <div className="home-card-list">
            <span>Артефакты и реликвии</span>
            <span>Скрытые механики</span>
            <span>Тактики боссов</span>
          </div>
          <button className="home-cta">Начать</button>
        </article>
      </section>

      <section className="home-bottom">
        <div className="home-bottom-card">
          <p>Посмотреть изменения</p>
        </div>
        <div className="home-bottom-actions">
          <Link href="/updates" className="home-secondary">
            Обновления игры
          </Link>
          <button className="home-primary">Начать приключение</button>
        </div>
      </section>
    </div>
  );
}
