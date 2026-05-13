"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        toast.success(`Tag "${name}" créé`);
        // Optimistic-ish — full refresh of the row would need round-trip.
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
    if (!confirm(`Supprimer le tag "${tagName}" ?`)) return;
    const fd = new FormData();
    fd.set("id", id);
    setTags((prev) => prev.filter((t) => t.id !== id));
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Tags existants</CardTitle>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink/45">
              Pas encore de tag. Créez le premier à droite.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <li
                  key={t.id}
                  className="group inline-flex items-center gap-2 rounded-lg border border-ink/8 bg-white px-2.5 py-1.5 shadow-soft dark:bg-white/5"
                >
                  <input
                    type="color"
                    value={t.color}
                    onChange={(e) => onColorChange(t.id, e.target.value)}
                    className="h-5 w-5 cursor-pointer rounded border border-ink/10 bg-transparent"
                    aria-label={`Couleur du tag ${t.name}`}
                    title="Changer la couleur"
                  />
                  <span
                    className="rounded-md px-2 py-0.5 text-xs font-semibold tracking-tight text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    #{t.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(t.id, t.name)}
                    disabled={pending}
                    className="opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                    aria-label="Supprimer"
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
          <CardTitle>Nouveau tag</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onCreate}>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-ink/70">Nom</span>
              <Input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="design, urgent, social…"
                maxLength={32}
                required
                disabled={pending}
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-ink/70">Couleur</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Choisir ${c}`}
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
                  aria-label="Autre couleur"
                />
              </div>
              <input type="hidden" name="color" value={color} />
              <div
                className="mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                #{name || "exemple"}
              </div>
            </div>

            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Création…" : "+ Créer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
