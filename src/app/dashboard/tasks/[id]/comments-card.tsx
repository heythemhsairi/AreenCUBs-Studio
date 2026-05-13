"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { useI18n } from "@/lib/i18n/provider";
import type { Dict } from "@/lib/i18n/dictionary";
import {
  addCommentAction,
  deleteCommentAction,
  searchMentionsAction,
} from "./comments-actions";

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
  const { t, locale } = useI18n();
  const [comments, setComments] = useState<CommentRow[]>(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionHits, setMentionHits] = useState<
    Array<{ username: string; full_name: string | null; avatar_url: string | null }>
  >([]);
  const [mentionIdx, setMentionIdx] = useState(0);

  // Detect @query at the caret position
  function updateMentionState() {
    const ta = textareaRef.current;
    if (!ta) return setMentionQuery(null);
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/(?:^|\s)@([a-zA-Z0-9._-]{0,32})$/);
    setMentionQuery(m ? m[1] : null);
  }

  useEffect(() => {
    if (mentionQuery === null) {
      setMentionHits([]);
      return;
    }
    let cancelled = false;
    searchMentionsAction(mentionQuery).then((hits) => {
      if (!cancelled) {
        setMentionHits(hits);
        setMentionIdx(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mentionQuery]);

  function insertMention(username: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(start);
    const replaced = before.replace(/@([a-zA-Z0-9._-]{0,32})$/, `@${username} `);
    const newBody = replaced + after;
    setBody(newBody);
    setMentionQuery(null);
    setTimeout(() => {
      ta.focus();
      const pos = replaced.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

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
    if (!confirm(t.taskDetail.deleteCommentConfirm)) return;
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
    // Mention autocomplete navigation
    if (mentionQuery !== null && mentionHits.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((i) => Math.min(mentionHits.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionHits[mentionIdx].username);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
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
          {t.taskDetail.comments}
          <span className="ml-1.5 text-xs font-medium text-ink/40">
            {comments.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="relative space-y-2">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setTimeout(updateMentionState, 0);
            }}
            onClick={updateMentionState}
            onKeyUp={updateMentionState}
            onKeyDown={onKeyDown}
            placeholder={t.taskDetail.writeComment}
            rows={2}
            disabled={pending}
          />

          {/* Mention autocomplete popover */}
          {mentionQuery !== null && mentionHits.length > 0 && (
            <div className="absolute left-2 right-2 top-full z-30 mt-1 max-w-xs overflow-hidden rounded-xl border border-ink/10 bg-white shadow-lift dark:border-white/10 dark:bg-[#1e2029]">
              <p className="border-b border-ink/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink/45">
                {t.taskDetail.mention}
              </p>
              <ul>
                {mentionHits.map((h, i) => (
                  <li key={h.username}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertMention(h.username)}
                      onMouseEnter={() => setMentionIdx(i)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        i === mentionIdx
                          ? "bg-brand/10 text-brand-dark dark:bg-brand/20 dark:text-brand"
                          : "hover:bg-cream-dark/40 dark:hover:bg-white/5"
                      }`}
                    >
                      <Avatar
                        src={h.avatar_url}
                        name={h.full_name ?? h.username}
                        size="xs"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {h.full_name ?? h.username}
                        </p>
                        <p className="truncate text-[11px] text-ink/45">
                          @{h.username}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink/40">
              <kbd className="rounded border border-ink/15 bg-cream-dark/50 px-1 py-px text-[10px] font-semibold">
                Ctrl
              </kbd>
              {" + "}
              <kbd className="rounded border border-ink/15 bg-cream-dark/50 px-1 py-px text-[10px] font-semibold">
                {t.taskDetail.enterKey}
              </kbd>{" "}
              {t.taskDetail.sendHint} ·{" "}
              <span className="font-mono">@</span>{" "}
              {t.taskDetail.mentionHint}
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={pending || !body.trim()}
            >
              {pending ? "…" : t.taskDetail.publish}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <div className="my-5 h-px bg-ink/5" />

        {comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/40">
            {t.taskDetail.noComments}
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
                t={t}
                locale={locale}
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
  t,
  locale,
}: {
  comment: CommentRow;
  canDelete: boolean;
  onDelete: () => void;
  t: Dict;
  locale: string;
}) {
  const a = comment.author;
  const name =
    a?.full_name ??
    (a?.username ? `@${a.username}` : t.taskDetail.userFallback);

  return (
    <li className="group flex items-start gap-3">
      <Avatar src={a?.avatar_url ?? null} name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-ink">{name}</span>
            <span className="text-ink/40">·</span>
            <time className="text-ink/45">
              {formatRelative(comment.created_at, t, locale)}
            </time>
          </div>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs text-ink/30 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
              title={t.common.delete}
              aria-label={t.taskDetail.deleteCommentTitle}
            >
              ×
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">
          {renderWithMentions(comment.body)}
        </p>
      </div>
    </li>
  );
}

/**
 * Splits a comment body so `@username` tokens render as styled pills.
 * Keeps everything else verbatim (newlines preserved by whitespace-pre-wrap).
 */
function renderWithMentions(body: string): React.ReactNode[] {
  const re = /(@[a-zA-Z0-9._-]{2,32})/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) out.push(body.slice(last, m.index));
    out.push(
      <span
        key={`m-${i++}`}
        className="rounded-md bg-brand/10 px-1 py-px font-semibold text-brand-dark dark:bg-brand/20 dark:text-brand"
      >
        {m[1]}
      </span>,
    );
    last = re.lastIndex;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

function formatRelative(iso: string, t: Dict, locale: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((now - then) / 1000);
  if (diff < 60) return t.taskDetail.now;
  if (diff < 3600) return t.taskDetail.minsAgo(Math.floor(diff / 60));
  if (diff < 86400) return t.taskDetail.hoursAgo(Math.floor(diff / 3600));
  if (diff < 86400 * 7) return t.taskDetail.daysAgo(Math.floor(diff / 86400));
  return new Date(iso).toLocaleDateString(
    locale === "en" ? "en-US" : "fr-FR",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );
}
