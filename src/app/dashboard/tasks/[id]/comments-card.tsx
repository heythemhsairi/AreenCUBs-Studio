"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { addCommentAction, deleteCommentAction } from "./comments-actions";

export type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export function CommentsCard({
  taskId,
  initial,
  currentUserId,
  isAdmin,
}: {
  taskId: string;
  initial: CommentRow[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [comments, setComments] = useState<CommentRow[]>(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);

    // Optimistic: prepend temporary row so the UI feels instant
    const tempId = "tmp-" + crypto.randomUUID();
    setComments((prev) => [
      {
        id: tempId,
        body: trimmed,
        created_at: new Date().toISOString(),
        author_id: currentUserId,
        author: null, // will be filled on refresh
      },
      ...prev,
    ]);
    setBody("");

    const fd = new FormData();
    fd.set("task_id", taskId);
    fd.set("body", trimmed);

    startTransition(async () => {
      const res = await addCommentAction(fd);
      if (!res.ok) {
        setError(res.error);
        // Roll back the optimistic entry
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setBody(trimmed);
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm("Supprimer ce commentaire ?")) return;
    const before = comments;
    setComments((prev) => prev.filter((c) => c.id !== id));
    const fd = new FormData();
    fd.set("id", id);
    fd.set("task_id", taskId);
    startTransition(async () => {
      const res = await deleteCommentAction(fd);
      if (!res.ok) {
        setError(res.error);
        setComments(before);
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl+Enter submits
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      const form = (e.currentTarget as HTMLTextAreaElement).form;
      form?.requestSubmit();
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>
          Commentaires
          <span className="ml-1.5 text-xs font-medium text-ink/40">
            {comments.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Écrire un commentaire…"
            rows={2}
            disabled={pending}
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink/40">
              <kbd className="rounded border border-ink/15 bg-cream-dark/50 px-1 py-px text-[10px] font-semibold">
                Ctrl
              </kbd>
              {" + "}
              <kbd className="rounded border border-ink/15 bg-cream-dark/50 px-1 py-px text-[10px] font-semibold">
                Entrée
              </kbd>{" "}
              pour envoyer
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={pending || !body.trim()}
            >
              {pending ? "…" : "Publier"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <div className="my-5 h-px bg-ink/5" />

        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/40">
            Aucun commentaire — soyez le premier.
          </p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => (
              <Item
                key={c.id}
                comment={c}
                canDelete={
                  isAdmin || (c.author_id !== null && c.author_id === currentUserId)
                }
                onDelete={() => onDelete(c.id)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Item({
  comment,
  canDelete,
  onDelete,
}: {
  comment: CommentRow;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const a = comment.author;
  const name = a?.full_name ?? (a?.username ? `@${a.username}` : "Utilisateur");

  return (
    <li className="group flex items-start gap-3">
      <Avatar src={a?.avatar_url ?? null} name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-ink">{name}</span>
            <span className="text-ink/40">·</span>
            <time className="text-ink/45">{formatRelative(comment.created_at)}</time>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-ink/30 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
              title="Supprimer"
              aria-label="Supprimer le commentaire"
            >
              ×
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">
          {comment.body}
        </p>
      </div>
    </li>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((now - then) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
