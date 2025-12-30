"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

import { apiFetch } from "@/lib/api";

type UpdateAdmin = {
  id: string;
  title: string;
  patch_date: string;
  content: string;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string | null;
  published_at: string | null;
  deleted_at: string | null;
};

type UpdateAdminListOut = {
  items: UpdateAdmin[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
};

export default function UpdatesAdminPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<UpdateAdmin[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [patchDate, setPatchDate] = useState("");
  const [status, setStatus] = useState<UpdateAdmin["status"]>("draft");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
      Image,
    ],
    content: "<p>Введите текст обновления...</p>",
  });

  const loadUpdates = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("q", search);
    if (includeDeleted) params.set("include_deleted", "true");
    const { data, error } = await apiFetch<UpdateAdminListOut>(
      `/updates/admin/list?${params.toString()}`,
    );
    if (!data) {
      setMessage(error?.detail ?? "Не удалось загрузить список.");
      setLoading(false);
      return;
    }
    setItems(data.items);
    setLoading(false);
  };

  useEffect(() => {
    loadUpdates();
  }, [statusFilter, includeDeleted]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setPatchDate("");
    setStatus("draft");
    editor?.commands.setContent("<p>Введите текст обновления...</p>");
  };

  const selectUpdate = (item: UpdateAdmin) => {
    setEditingId(item.id);
    setTitle(item.title);
    setPatchDate(item.patch_date);
    setStatus(item.status);
    editor?.commands.setContent(item.content || "<p></p>");
  };

  const saveUpdate = async () => {
    if (!title || !patchDate || !editor) {
      setMessage("Заполните дату, название и контент.");
      return;
    }
    setBusy(true);
    const payload = {
      title,
      patch_date: patchDate,
      content: editor.getHTML(),
      status,
    };
    const path = editingId ? `/updates/${editingId}` : "/updates";
    const method = editingId ? "PATCH" : "POST";
    const { error, response } = await apiFetch<UpdateAdmin>(path, {
      method,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setMessage(error?.detail ?? "Ошибка сохранения.");
      setBusy(false);
      return;
    }
    setMessage(editingId ? "Обновление изменено." : "Обновление создано.");
    resetForm();
    await loadUpdates();
    setBusy(false);
  };

  const publishUpdate = async (id: string) => {
    setBusy(true);
    const { error, response } = await apiFetch(`/updates/${id}/publish`, { method: "POST" });
    if (!response.ok) {
      setMessage(error?.detail ?? "Не удалось опубликовать.");
      setBusy(false);
      return;
    }
    setMessage("Обновление опубликовано.");
    await loadUpdates();
    setBusy(false);
  };

  const unpublishUpdate = async (id: string) => {
    setBusy(true);
    const { error, response } = await apiFetch(`/updates/${id}/unpublish`, { method: "POST" });
    if (!response.ok) {
      setMessage(error?.detail ?? "Не удалось снять с публикации.");
      setBusy(false);
      return;
    }
    setMessage("Обновление снято с публикации.");
    await loadUpdates();
    setBusy(false);
  };

  const deleteUpdate = async (id: string) => {
    if (!confirm("Удалить обновление? Оно будет скрыто, но останется в базе.")) return;
    setBusy(true);
    const { error, response } = await apiFetch(`/updates/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage(error?.detail ?? "Не удалось удалить.");
      setBusy(false);
      return;
    }
    setMessage("Обновление удалено.");
    await loadUpdates();
    setBusy(false);
  };

  const restoreUpdate = async (id: string) => {
    setBusy(true);
    const { error, response } = await apiFetch(`/updates/${id}/restore`, { method: "POST" });
    if (!response.ok) {
      setMessage(error?.detail ?? "Не удалось восстановить.");
      setBusy(false);
      return;
    }
    setMessage("Обновление восстановлено.");
    await loadUpdates();
    setBusy(false);
  };

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/updates/media", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) {
      setMessage("Не удалось загрузить изображение.");
      return;
    }
    const data = (await response.json()) as { url: string };
    editor?.chain().focus().setImage({ src: data.url }).run();
  };

  const toolbarButtons = useMemo(
    () => [
      { label: "Bold", action: () => editor?.chain().focus().toggleBold().run() },
      { label: "Italic", action: () => editor?.chain().focus().toggleItalic().run() },
      { label: "Bullet", action: () => editor?.chain().focus().toggleBulletList().run() },
      { label: "Ordered", action: () => editor?.chain().focus().toggleOrderedList().run() },
      { label: "H2", action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
      { label: "Link", action: () => {
          const url = prompt("Введите ссылку");
          if (url) editor?.chain().focus().setLink({ href: url }).run();
        },
      },
    ],
    [editor],
  );

  return (
    <div className="updates-admin-shell">
      <header className="updates-admin-header">
        <div>
          <p className="updates-admin-kicker">Moderator</p>
          <h2 className="updates-admin-title">Управление обновлениями</h2>
          <p className="updates-admin-subtitle">
            Создавайте патчи, публикуйте, редактируйте и управляйте медиа.
          </p>
        </div>
        <Link href="/moderator" className="updates-admin-back">
          Назад в админку
        </Link>
      </header>

      <div className="updates-admin-grid">
        <section className="updates-admin-panel">
          <h3>Список патчей</h3>
          <div className="updates-admin-filters">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по названию"
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Все статусы</option>
              <option value="draft">Черновик</option>
              <option value="published">Опубликован</option>
              <option value="archived">Архив</option>
            </select>
            <label className="updates-admin-checkbox">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => setIncludeDeleted(event.target.checked)}
              />
              Показать удаленные
            </label>
            <button onClick={loadUpdates}>Найти</button>
          </div>

          {loading && <p className="updates-admin-empty">Загрузка...</p>}
          {!loading && items.length === 0 && <p className="updates-admin-empty">Пусто.</p>}
          <div className="updates-admin-list">
            {items.map((item) => (
              <div key={item.id} className={`updates-admin-item ${item.deleted_at ? "is-deleted" : ""}`}>
                <div>
                  <p className="updates-admin-item-title">{item.title}</p>
                  <span>{item.patch_date}</span>
                  <span className={`updates-admin-status ${item.status}`}>{item.status}</span>
                </div>
                <div className="updates-admin-actions">
                  <button onClick={() => selectUpdate(item)}>Редактировать</button>
                  {item.deleted_at ? (
                    <button onClick={() => restoreUpdate(item.id)}>Восстановить</button>
                  ) : (
                    <button onClick={() => deleteUpdate(item.id)}>Удалить</button>
                  )}
                  {item.status !== "published" && !item.deleted_at && (
                    <button onClick={() => publishUpdate(item.id)}>Publish</button>
                  )}
                  {item.status === "published" && !item.deleted_at && (
                    <button onClick={() => unpublishUpdate(item.id)}>Unpublish</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="updates-admin-panel">
          <h3>{editingId ? "Редактирование патча" : "Новый патч"}</h3>
          {message && <p className="updates-admin-message">{message}</p>}
          <div className="updates-admin-form">
            <label>
              Дата патча*
              <input
                type="date"
                value={patchDate}
                onChange={(event) => setPatchDate(event.target.value)}
              />
            </label>
            <label>
              Название*
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например: Патч 1.2.3"
              />
            </label>
            <label>
              Статус
              <select value={status} onChange={(event) => setStatus(event.target.value as UpdateAdmin["status"])}>
                <option value="draft">Черновик</option>
                <option value="published">Опубликован</option>
                <option value="archived">Архив</option>
              </select>
            </label>

            <div className="updates-admin-editor">
              <div className="updates-admin-toolbar">
                {toolbarButtons.map((btn) => (
                  <button key={btn.label} onClick={btn.action} type="button">
                    {btn.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Image
                </button>
              </div>
              <EditorContent editor={editor} className="updates-editor" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadImage(file);
                event.target.value = "";
              }}
            />
            <div className="updates-admin-buttons">
              <button onClick={saveUpdate} disabled={busy}>
                {editingId ? "Сохранить изменения" : "Создать патч"}
              </button>
              {editingId && (
                <button className="ghost" onClick={resetForm} type="button">
                  Отмена
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
