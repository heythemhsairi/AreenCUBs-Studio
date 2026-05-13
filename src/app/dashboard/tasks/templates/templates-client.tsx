"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/table";
import { toast } from "@/components/toast";
import {
  createTaskTemplateAction,
  deleteTaskTemplateAction,
} from "../templates-actions";

export type TaskTemplateRow = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  default_deadline_offset_days: number | null;
  created_at: string;
};

const priorityTone: Record<
  TaskTemplateRow["priority"],
  "slate" | "neutral" | "amber" | "red"
> = {
  low: "slate",
  normal: "neutral",
  high: "amber",
  urgent: "red",
};

export function TemplatesClient({
  initial,
}: {
  initial: TaskTemplateRow[];
}) {
  const [rows, setRows] = useState<TaskTemplateRow[]>(initial);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createTaskTemplateAction(fd);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success("Modèle créé");
        (e.target as HTMLFormElement).reset();
        // soft refresh — the page will revalidate on next nav
        window.location.reload();
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm("Supprimer ce modèle ?")) return;
    const before = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const res = await deleteTaskTemplateAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        setRows(before);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        {rows.length === 0 ? (
          <EmptyState>
            Aucun modèle. Créez le premier à droite.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <Card key={row.id} interactive>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-ink">
                          {row.name}
                        </h3>
                        <Badge tone={priorityTone[row.priority]}>
                          {row.priority}
                        </Badge>
                        {row.default_deadline_offset_days !== null && (
                          <Badge tone="blue">
                            +{row.default_deadline_offset_days}j
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-ink/70">
                        <span className="text-ink/45">Titre par défaut :</span>{" "}
                        {row.title}
                      </p>
                      {row.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-ink/55">
                          {row.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDelete(row.id)}
                      className="text-xs text-ink/30 hover:text-red-600"
                    >
                      Supprimer
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </ul>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouveau modèle</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <Field label="Nom du modèle">
              <Input
                name="name"
                required
                placeholder="Ex: Pack publication LinkedIn"
              />
            </Field>
            <Field label="Titre de la tâche">
              <Input
                name="title"
                required
                placeholder="Ex: Publication LinkedIn — semaine X"
              />
            </Field>
            <Field label="Description">
              <Textarea
                name="description"
                rows={3}
                placeholder="Brief, livrables attendus, etc."
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priorité">
                <Select name="priority" defaultValue="normal">
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </Select>
              </Field>
              <Field label="Échéance par défaut">
                <Input
                  name="default_deadline_offset_days"
                  type="number"
                  min="0"
                  placeholder="Jours (ex. 7)"
                />
              </Field>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "…" : "Créer le modèle"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/55">
        {label}
      </label>
      {children}
    </div>
  );
}
