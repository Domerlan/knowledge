"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function NotFound() {
  useEffect(() => {
    document.body.classList.add("not-found-mode");
    return () => {
      document.body.classList.remove("not-found-mode");
    };
  }, []);

  return (
    <div className="not-found-shell">
      <div className="not-found-card">
        <p className="text-xs uppercase tracking-[0.4em] text-base-50/70">BDM Knowledge</p>
        <h2 className="mt-4 font-display text-5xl md:text-6xl">Ooops! 404</h2>
        <p className="mt-3 text-base text-base-50/85">Такой страницы нет.</p>
        <Link
          href="/"
          className="mt-6 rounded-full border border-base-50/40 px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-base-50 transition hover:bg-base-50 hover:text-ink-900"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
