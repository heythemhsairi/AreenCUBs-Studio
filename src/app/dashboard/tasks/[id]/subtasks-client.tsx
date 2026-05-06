"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/charts/progress-ring";
import {
  createSubtaskAction,
  toggleSubtaskAction,
  deleteSubtaskAction,
} from "../actions";

export type Subtask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done" | "cancelled";
};

export function SubtasksCard({
  parentId,
  initial,
}: {
  parentId: string;
  initial: Subtask[];
}) {
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

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Sous-tâches{" "}
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
            Aucune sous-tâche pour l&apos;instant.
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
                className={`flex-1 text-sm ${
                  s.status === "done"
                    ? "text-ink/40 line-through"
                    : "text-ink"
                }`}
              >
                {s.title}
              </span>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                className="text-xs text-ink/30 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                title="Supprimer"
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
            placeholder="Ajouter une sous-tâche…"
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
