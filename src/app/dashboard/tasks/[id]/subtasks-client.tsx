"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/charts/progress-ring";
import { Avatar } from "@/components/avatar";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import {
  createSubtaskAction,
  toggleSubtaskAction,
  deleteSubtaskAction,
  setTaskAssigneesAction,
} from "../actions";

type Person = { id: string; label: string; avatar_url: string | null };

export type Subtask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done" | "cancelled";
  assignee_ids?: string[];
};

export function SubtasksCard({
  parentId,
  initial,
  people = [],
}: {
  parentId: string;
  initial: Subtask[];
  people?: Person[];
}) {
  const { t } = useI18n();
  const [items, setItems] = useState(initial);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = items.length;
  const done = items.filter((s) => s.status === "done").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    const fd = new FormData();
    fd.set("parent_task_id", parentId);
    fd.set("title", title.trim());
    startTransition(async () => {
      const res = await createSubtaskAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Optimistic UI: append a temp item, will refresh on next nav
      setItems((prev) => [
        ...prev,
        { id: crypto.randomUUID(), title: title.trim(), status: "todo" },
      ]);
      setTitle("");
    });
  }

  function onToggle(id: string, checked: boolean) {
    setItems((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: checked ? "done" : "todo" } : s,
      ),
    );
    startTransition(async () => {
      await toggleSubtaskAction(id, checked);
    });
  }

  function onDelete(id: string) {
    setItems((prev) => prev.filter((s) => s.id !== id));
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteSubtaskAction(fd);
    });
  }

  function onAssign(id: string, ids: string[]) {
    setItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, assignee_ids: ids } : s)),
    );
    startTransition(async () => {
      await setTaskAssigneesAction(id, ids);
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {t.taskDetail.subtasks}{" "}
            <span className="ml-1 text-xs font-medium text-ink/45">
              {done}/{total}
            </span>
          </CardTitle>
          {total > 0 && (
            <ProgressRing
              value={pct}
              size={56}
              thickness={6}
              label={
                <span className="text-[11px] font-semibold text-ink">
                  {pct}%
                </span>
              }
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 && (
          <p className="mb-3 text-xs text-ink/45">
            {t.taskDetail.noSubtasks}
          </p>
        )}

        <ul className="space-y-1.5">
          {items.map((s) => (
            <li
              key={s.id}
              className="group flex items-center gap-3 rounded-lg border border-white/40 bg-white/60 px-3 py-2 transition-colors hover:bg-white/80"
            >
              <Checkbox
                checked={s.status === "done"}
                onChange={(c) => onToggle(s.id, c)}
                disabled={pending}
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  s.status === "done"
                    ? "text-ink/40 line-through"
                    : "text-ink"
                }`}
              >
                {s.title}
              </span>
              {people.length > 0 && (
                <SubtaskAssignees
                  people={people}
                  selected={s.assignee_ids ?? []}
                  onChange={(ids) => onAssign(s.id, ids)}
                  disabled={pending}
                />
              )}
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                className="shrink-0 text-xs text-ink/30 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                title={t.common.delete}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={onAdd} className="mt-3 flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.taskDetail.addSubtaskPlaceholder}
          />
          <Button type="submit" size="sm" disabled={pending || !title.trim()}>
            +
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

function SubtaskAssignees({
  people,
  selected,
  onChange,
  disabled,
}: {
  people: Person[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }
  }, [open]);

  const chosen = people.filter((p) => selected.includes(p.id));

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center -space-x-1.5 rounded-full px-1 py-0.5 transition-colors hover:bg-ink/5"
        title="Assigner"
      >
        {chosen.length === 0 ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-ink/30 text-[11px] text-ink/40">
            +
          </span>
        ) : (
          chosen
            .slice(0, 3)
            .map((p) => (
              <span
                key={p.id}
                className="rounded-full ring-2 ring-white dark:ring-[#15171f]"
              >
                <Avatar src={p.avatar_url} name={p.label} size="xs" />
              </span>
            ))
        )}
        {chosen.length > 3 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/10 text-[10px] font-semibold text-ink/60 ring-2 ring-white dark:ring-[#15171f]">
            +{chosen.length - 3}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 max-h-60 w-56 overflow-y-auto rounded-xl border border-ink/10 bg-white p-1 shadow-lift dark:border-white/10 dark:bg-[#1e2029]">
          {people.map((p) => {
            const on = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  on
                    ? "bg-brand/10 text-brand-dark dark:text-brand"
                    : "text-ink/75 hover:bg-ink/5",
                )}
              >
                <Avatar src={p.avatar_url} name={p.label} size="xs" />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                {on && (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
        checked
          ? "border-brand bg-brand text-white"
          : "border-ink/20 bg-white hover:border-brand"
      } ${disabled ? "opacity-60" : ""}`}
      aria-pressed={checked}
    >
      {checked && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}
