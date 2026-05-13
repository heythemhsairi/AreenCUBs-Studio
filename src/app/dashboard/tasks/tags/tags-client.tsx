"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { useI18n } from "@/lib/i18n/provider";
import { toast } from "@/components/toast";
import {
  createTagAction,
  deleteTagAction,
  updateTagAction,
} from "./actions";

export type TagRow = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

const PRESET_COLORS = [
  "#3B8BBA", // brand
  "#FF9E1F", // accent
  "#1E1E24", // ink
  "#10B981", // emerald
  "#EF4444", // red
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#F59E0B", // amber
  "#EC4899", // pink
];

export function TagsClient({ initial }: { initial: TagRow[] }) {
  const { t } = useI18n();
  const [tags, setTags] = useState(initial);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [pending, startTransition] = useTransition();

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createTagAction(fd);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(t.tags.created(name));
        setTags((prev) =>
          [
            ...prev,
            {
              id: `tmp-${Date.now()}`,
              name: name.toLowerCase().replace(/^#/, ""),
              color,
              created_at: new Date().toISOString(),
            },
          ].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setName("");
      }
    });
  }

  function onDelete(id: string, tagName: string) {
    if (!confirm(t.tags.deleteConfirm(tagName))) return;
    const fd = new FormData();
    fd.set("id", id);
    setTags((prev) => prev.filter((x) => x.id !== id));
    startTransition(async () => {
      const res = await deleteTagAction(fd);
      if (!res.ok) toast.error(res.error);
    });
  }

  function onColorChange(id: string, newColor: string) {
    setTags((prev) =>
      prev.map((t) => (t.id === id ? { ...t, color: newColor } : t)),
    );
    const fd = new FormData();
    fd.set("id", id);
    fd.set("color", newColor);
    startTransition(async () => {
      const res = await updateTagAction(fd);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.tags.title}
        subtitle={
          <Link href="/dashboard/tasks" className="hover:underline">
            {t.common.backToTasks}
          </Link>
        }
        description={t.tags.description}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>{t.tags.existing}</CardTitle>
          </CardHeader>
          <CardContent>
            {tags.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink/45">
                {t.tags.empty}
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <li
                    key={tag.id}
                    className="group inline-flex items-center gap-2 rounded-lg border border-ink/8 bg-white px-2.5 py-1.5 shadow-soft dark:bg-white/5"
                  >
                    <input
                      type="color"
                      value={tag.color}
                      onChange={(e) => onColorChange(tag.id, e.target.value)}
                      className="h-5 w-5 cursor-pointer rounded border border-ink/10 bg-transparent"
                      aria-label={`${t.tags.color} ${tag.name}`}
                      title={t.tags.color}
                    />
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-semibold tracking-tight text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      #{tag.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(tag.id, tag.name)}
                      disabled={pending}
                      className="opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                      aria-label={t.common.delete}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card variant="ring">
          <CardHeader>
            <CardTitle>{t.tags.newTag}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onCreate}>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-ink/70">
                  {t.tags.name}
                </span>
                <Input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.tags.placeholder}
                  maxLength={32}
                  required
                  disabled={pending}
                />
              </label>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-ink/70">
                  {t.tags.color}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      onClick={() => setColor(c)}
                      className="h-7 w-7 rounded-md border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: color === c ? "#1E1E24" : "transparent",
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-7 w-7 cursor-pointer rounded-md border-2 border-transparent bg-transparent"
                    aria-label={t.tags.otherColor}
                  />
                </div>
                <input type="hidden" name="color" value={color} />
                <div
                  className="mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  #{name || t.tags.preview}
                </div>
              </div>

              <Button type="submit" disabled={pending || !name.trim()}>
                {pending ? t.tags.creating : t.tags.create}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
