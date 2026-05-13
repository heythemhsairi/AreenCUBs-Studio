"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { createTaskAction, updateTaskAction } from "./actions";

type Project = { id: string; name: string; client_name: string | null };
type Assignee = {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
};

type TaskRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  assignee_id: string | null;
  deadline: string | null;
  deliverable_url: string | null;
  tags?: string[] | null;
  recurrence?: "daily" | "weekly" | "biweekly" | "monthly" | null;
};

export type TaskTemplateOption = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  default_deadline_offset_days: number | null;
};

type Props =
  | {
      mode: "create";
      defaultProjectId?: string;
      projects: Project[];
      assignees: Assignee[];
      templates?: TaskTemplateOption[];
      preselectedTemplate?: TaskTemplateOption | null;
      task?: undefined;
    }
  | {
      mode: "edit";
      task: TaskRow;
      assignees: Assignee[];
      projects?: undefined;
      defaultProjectId?: undefined;
      templates?: undefined;
      preselectedTemplate?: undefined;
    };

export function TaskForm(props: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const tpl = props.mode === "create" ? props.preselectedTemplate : null;
  const templates = props.mode === "create" ? props.templates ?? [] : [];

  // Template-derived defaults (only in create mode)
  const tplDefaults =
    tpl
      ? {
          title: tpl.title,
          description: tpl.description ?? "",
          priority: tpl.priority,
          deadline:
            tpl.default_deadline_offset_days !== null
              ? new Date(
                  Date.now() +
                    tpl.default_deadline_offset_days * 24 * 60 * 60 * 1000,
                )
                  .toISOString()
                  .slice(0, 10)
              : "",
        }
      : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createTaskAction(fd)
          : await updateTaskAction(fd);
      if (res && !res.ok) setError(res.error);
      else if (res?.ok) setSaved(true);
    });
  }

  const tk = props.mode === "edit" ? props.task : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          props.mode === "create"
            ? t.tasks.addTitle
            : (tk?.title ?? t.tasks.title)
        }
        subtitle={
          <Link href="/dashboard/tasks" className="hover:underline">
            ← {t.tasks.title}
          </Link>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            {props.mode === "create" ? t.common.create : t.common.edit}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {props.mode === "edit" && (
              <input type="hidden" name="id" value={tk?.id} />
            )}

            {props.mode === "create" ? (
              <Field label={t.tasks.form.project}>
                <Select
                  name="project_id"
                  required
                  defaultValue={props.defaultProjectId ?? ""}
                >
                  <option value="">{t.tasks.form.noProject}</option>
                  {props.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.client_name ? `${p.client_name} — ${p.name}` : p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="project_id" value={tk?.project_id} />
            )}

            {props.mode === "create" && templates.length > 0 && (
              <Field label="Modèle (optionnel)">
                <div className="flex items-center gap-2">
                  <Select
                    value={tpl?.id ?? ""}
                    onChange={(e) => {
                      const params = new URLSearchParams();
                      if (props.defaultProjectId)
                        params.set("projectId", props.defaultProjectId);
                      if (e.target.value)
                        params.set("templateId", e.target.value);
                      router.replace(
                        `/dashboard/tasks/new${params.toString() ? "?" + params.toString() : ""}`,
                      );
                    }}
                  >
                    <option value="">— Aucun —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                  <Link
                    href="/dashboard/tasks/templates"
                    className="shrink-0 text-xs font-semibold text-brand hover:text-brand-dark"
                  >
                    Gérer →
                  </Link>
                </div>
              </Field>
            )}

            <Field label={t.tasks.form.title}>
              <Input
                key={tpl?.id ?? "no-tpl-title"}
                name="title"
                required
                defaultValue={tk?.title ?? tplDefaults?.title ?? ""}
              />
            </Field>

            <Field label={t.tasks.form.description}>
              <Textarea
                key={tpl?.id ?? "no-tpl-desc"}
                name="description"
                rows={3}
                defaultValue={tk?.description ?? tplDefaults?.description ?? ""}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.tasks.form.assignee}>
                <Select
                  name="assignee_id"
                  defaultValue={tk?.assignee_id ?? ""}
                >
                  <option value="">{t.tasks.form.unassigned}</option>
                  {props.assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name ?? `@${a.username}`} ({a.role})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t.tasks.form.deadline}>
                <Input
                  key={tpl?.id ?? "no-tpl-deadline"}
                  name="deadline"
                  type="date"
                  defaultValue={
                    tk?.deadline ?? tplDefaults?.deadline ?? ""
                  }
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.tasks.form.status}>
                <Select name="status" defaultValue={tk?.status ?? "todo"}>
                  <option value="todo">{t.tasks.status.todo}</option>
                  <option value="in_progress">
                    {t.tasks.status.in_progress}
                  </option>
                  <option value="review">{t.tasks.status.review}</option>
                  <option value="done">{t.tasks.status.done}</option>
                  <option value="cancelled">{t.tasks.status.cancelled}</option>
                </Select>
              </Field>
              <Field label={t.tasks.form.priority}>
                <Select
                  key={tpl?.id ?? "no-tpl-pri"}
                  name="priority"
                  defaultValue={
                    tk?.priority ?? tplDefaults?.priority ?? "normal"
                  }
                >
                  <option value="low">{t.tasks.priority.low}</option>
                  <option value="normal">{t.tasks.priority.normal}</option>
                  <option value="high">{t.tasks.priority.high}</option>
                  <option value="urgent">{t.tasks.priority.urgent}</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tags">
                <Input
                  name="tags"
                  placeholder="design, urgent, social…"
                  defaultValue={(tk?.tags ?? []).join(", ")}
                />
                <p className="text-[11px] text-ink/45">
                  Séparez par des virgules.{" "}
                  <Link
                    href="/dashboard/tasks/tags"
                    className="font-semibold text-brand hover:text-brand-dark"
                  >
                    Gérer les tags →
                  </Link>
                </p>
              </Field>
              <Field label="Récurrence">
                <Select
                  name="recurrence"
                  defaultValue={tk?.recurrence ?? ""}
                >
                  <option value="">— Aucune —</option>
                  <option value="daily">Quotidienne</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="biweekly">Bimensuelle</option>
                  <option value="monthly">Mensuelle</option>
                </Select>
                <p className="text-[11px] text-ink/45">
                  Une nouvelle instance est créée automatiquement à la fin.
                </p>
              </Field>
            </div>

            <Field label={t.tasks.form.deliverableUrl}>
              <Input
                name="deliverable_url"
                type="url"
                placeholder="https://…"
                defaultValue={tk?.deliverable_url ?? ""}
              />
            </Field>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && <p className="text-sm text-green-600">{t.common.saved}</p>}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={pending}>
                {pending
                  ? t.common.saving
                  : props.mode === "create"
                    ? t.common.create
                    : t.common.save}
              </Button>
              <Link
                href={
                  props.mode === "create"
                    ? "/dashboard/tasks"
                    : `/dashboard/tasks/${tk?.id}`
                }
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                {t.common.cancel}
              </Link>
            </div>
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
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
