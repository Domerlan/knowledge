"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type Section = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  sort_order: number;
  is_visible: boolean;
};

type Article = {
  id: string;
  section_id: string;
  slug: string;
  title: string;
  content: string;
  status: "draft" | "published" | "archived";
  author_id: string;
};

type Comment = {
  id: string;
  article_id: string;
  author_id: string;
  content: string;
  is_hidden: boolean;
};

export default function ModeratorPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [commentArticleId, setCommentArticleId] = useState("");
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);

  const [section, setSection] = useState({
    title: "",
    slug: "",
    description: "",
    sort_order: 0,
    is_visible: true,
  });

  const [article, setArticle] = useState({
    section_id: "",
    slug: "",
    title: "",
    content: "",
    status: "draft" as Article["status"],
  });

  const loadData = async () => {
    setLoading(true);
    const [sectionsRes, articlesRes] = await Promise.all([
      apiFetch<Section[]>("/sections/all"),
      apiFetch<Article[]>("/articles/all"),
    ]);
    if (sectionsRes.data) setSections(sectionsRes.data);
    if (articlesRes.data) setArticles(articlesRes.data);
    if (sectionsRes.error || articlesRes.error) {
      setMessage(sectionsRes.error?.detail ?? articlesRes.error?.detail ?? "Failed to load data");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const createSection = async () => {
    setMessage(null);
    const { response, error } = await apiFetch("/sections", {
      method: "POST",
      body: JSON.stringify(section),
    });
    if (!response.ok) {
      setMessage(error?.detail ?? "Failed to create section");
      return;
    }
    setMessage("Section created");
    setSection({ title: "", slug: "", description: "", sort_order: 0, is_visible: true });
    loadData();
  };

  const saveArticle = async () => {
    setMessage(null);
    const isEdit = Boolean(editingArticleId);
    const path = isEdit ? `/articles/${editingArticleId}` : "/articles";
    const method = isEdit ? "PATCH" : "POST";

    const { response, error } = await apiFetch(path, {
      method,
      body: JSON.stringify(article),
    });

    if (!response.ok) {
      setMessage(error?.detail ?? "Failed to save article");
      return;
    }

    setMessage(isEdit ? "Article updated" : "Article created");
    setEditingArticleId(null);
    setArticle({ section_id: "", slug: "", title: "", content: "", status: "draft" });
    loadData();
  };

  const publishArticle = async (articleId: string) => {
    setMessage(null);
    const { response, error } = await apiFetch(`/articles/${articleId}/publish`, {
      method: "POST",
    });
    if (!response.ok) {
      setMessage(error?.detail ?? "Failed to publish");
      return;
    }
    setMessage("Article published");
    loadData();
  };

  const selectArticle = (selected: Article) => {
    setEditingArticleId(selected.id);
    setArticle({
      section_id: selected.section_id,
      slug: selected.slug,
      title: selected.title,
      content: selected.content,
      status: selected.status,
    });
  };

  const loadComments = async () => {
    setMessage(null);
    if (!commentArticleId) {
      setMessage("Provide article ID to load comments");
      return;
    }
    const { data, error, response } = await apiFetch<Comment[]>(
      `/articles/${commentArticleId}/comments`,
    );
    if (!response.ok || !data) {
      setMessage(error?.detail ?? "Failed to load comments");
      return;
    }
    setComments(data);
  };

  const hideComment = async (commentId: string) => {
    const { response, error } = await apiFetch(`/comments/${commentId}/hide`, {
      method: "PATCH",
    });
    if (!response.ok) {
      setMessage(error?.detail ?? "Failed to hide comment");
      return;
    }
    setComments((prev) => prev.map((item) => (item.id === commentId ? { ...item, is_hidden: true } : item)));
  };

  return (
    <div className="space-y-8">
      <Card className="animate-in">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-ink-900">Moderator control</h2>
            <p className="mt-2 text-sm text-ink-600">Create, edit, and publish content.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link className="text-sm text-ink-600 hover:text-ink-900" href="/moderator/updates">
              Updates
            </Link>
            <Button variant="ghost" onClick={loadData} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>
        {message && <p className="mt-4 text-sm text-accent-600">{message}</p>}
      </Card>

      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <Card className="animate-in">
          <h3 className="font-display text-2xl text-ink-900">Sections</h3>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="Title"
              value={section.title}
              onChange={(event) => setSection({ ...section, title: event.target.value })}
            />
            <Input
              placeholder="Slug"
              value={section.slug}
              onChange={(event) => setSection({ ...section, slug: event.target.value })}
            />
            <Input
              placeholder="Description"
              value={section.description}
              onChange={(event) => setSection({ ...section, description: event.target.value })}
            />
            <Input
              placeholder="Sort order"
              type="number"
              value={section.sort_order}
              onChange={(event) => setSection({ ...section, sort_order: Number(event.target.value) })}
            />
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={section.is_visible}
                onChange={(event) => setSection({ ...section, is_visible: event.target.checked })}
              />
              Visible to public
            </label>
            <Button onClick={createSection}>Create section</Button>
          </div>
          <div className="mt-6 space-y-3">
            {sections.length === 0 ? (
              <p className="text-sm text-ink-500">No sections yet.</p>
            ) : (
              sections.map((item) => (
                <div key={item.id} className="rounded-2xl border border-ink-900/10 bg-white/80 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-ink-900">{item.title}</p>
                      <p className="text-xs text-ink-500">/{item.slug}</p>
                    </div>
                    <span className="text-xs text-ink-500">#{item.sort_order}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="animate-in">
          <h3 className="font-display text-2xl text-ink-900">Articles</h3>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="Section ID"
              value={article.section_id}
              onChange={(event) => setArticle({ ...article, section_id: event.target.value })}
            />
            <Input
              placeholder="Slug"
              value={article.slug}
              onChange={(event) => setArticle({ ...article, slug: event.target.value })}
            />
            <Input
              placeholder="Title"
              value={article.title}
              onChange={(event) => setArticle({ ...article, title: event.target.value })}
            />
            <Input
              placeholder="Content"
              value={article.content}
              onChange={(event) => setArticle({ ...article, content: event.target.value })}
            />
            <select
              className="w-full rounded-xl border border-ink-700/20 bg-white/80 px-4 py-2 text-sm text-ink-900"
              value={article.status}
              onChange={(event) =>
                setArticle({ ...article, status: event.target.value as Article["status"] })
              }
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
            <div className="flex flex-wrap gap-3">
              <Button onClick={saveArticle}>{editingArticleId ? "Update" : "Create"} article</Button>
              {editingArticleId && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingArticleId(null);
                    setArticle({ section_id: "", slug: "", title: "", content: "", status: "draft" });
                  }}
                >
                  Cancel edit
                </Button>
              )}
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {articles.length === 0 ? (
              <p className="text-sm text-ink-500">No articles yet.</p>
            ) : (
              articles.map((item) => (
                <div key={item.id} className="rounded-2xl border border-ink-900/10 bg-white/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink-900">{item.title}</p>
                      <p className="text-xs text-ink-500">/{item.slug}</p>
                      <p className="mt-1 text-xs text-ink-500">Status: {item.status}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="ghost" onClick={() => selectArticle(item)}>
                        Edit
                      </Button>
                      {item.status !== "published" && (
                        <Button onClick={() => publishArticle(item.id)}>Publish</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="animate-in">
        <h3 className="font-display text-2xl text-ink-900">Comments moderation</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Input
            placeholder="Article ID"
            value={commentArticleId}
            onChange={(event) => setCommentArticleId(event.target.value)}
          />
          <Button onClick={loadComments}>Load comments</Button>
        </div>
        <div className="mt-6 space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-ink-500">No comments loaded.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-ink-900/10 bg-white/80 p-3">
                <p className="text-sm text-ink-700">{comment.content}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
                  <span>{comment.id}</span>
                  {comment.is_hidden ? (
                    <span className="text-red-600">Hidden</span>
                  ) : (
                    <Button variant="ghost" onClick={() => hideComment(comment.id)}>
                      Hide
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
