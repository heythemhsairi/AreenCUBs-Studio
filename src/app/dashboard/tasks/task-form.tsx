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
import { MultiAssignee } from "@/components/multi-assignee";
import { createTaskAction, updateTaskAction } from "./actions";
import { taskOpenMessage } from "@/lib/role-copy";
import type { UserRole } from "@/lib/utils";

type Project = { id: string; name: string; client_name: string | null };
type Assignee = {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  avatar_url?: string | null;
};

type TaskRow = {
  id: string;
  project_id: string | null;
  work_scope: "client" | "studio";
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  assignee_id: string | null;
  assignee_ids?: string[];
  deadline: string | null;
  deliverable_url: string | null;
  tags?: string[] | null;
  recurrence?: "daily" | "weekly" | "biweekly" | "monthly" | null;
  estimated_minutes?: number | null;
  late_reason?: string | null;
  completion_note?: string | null;
  payroll_task_type_id?: string | null;
  payroll_credit_user_id?: string | null;
};

export type TaskTemplateOption = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  default_deadline_offset_days: number | null;
};

type PayrollProps = {
  canManagePayroll?: boolean;
  payrollTaskTypes?: { id: string; label: string; base_rate_millimes: number; output_points: number }[];
  payrollWorkers?: { id: string; username: string; full_name: string | null }[];
};

type Props = (
  | {
      mode: "create";
      defaultProjectId?: string;
      defaultScope?: "client" | "studio";
      scopeLocked?: boolean;
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
      defaultScope?: undefined;
      scopeLocked?: undefined;
      templates?: undefined;
      preselectedTemplate?: undefined;
    }) & PayrollProps & { currentRole: UserRole };

export function TaskForm(props: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [workScope, setWorkScope] = useState<"client" | "studio">(
    props.mode === "create" ? props.defaultScope ?? "client" : props.task.work_scope,
  );

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
          <Link href={workScope === "studio" ? "/dashboard/studio-tasks" : "/dashboard/tasks"} className="hover:underline">
            ← {workScope === "studio" ? t.studioTasks.title : t.tasks.title}
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
          {props.mode === "edit" && (
            <div className="mb-5 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm leading-relaxed text-content-2">
              <span aria-hidden className="mr-2">💙</span>
              {taskOpenMessage(props.currentRole, locale)}
            </div>
          )}
          <form className="space-y-4" onSubmit={onSubmit}>
            {props.mode === "edit" && (
              <input type="hidden" name="id" value={tk?.id} />
            )}

            {props.mode === "create" ? (
              <>
                {props.scopeLocked ? (
                  <>
                    <input type="hidden" name="work_scope" value={workScope} />
                    <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm font-semibold text-brand">✨ {t.tasksUi.studioWork}</div>
                  </>
                ) : (
                  <Field label={t.tasksUi.workScope}>
                    <Select name="work_scope" value={workScope} onChange={(event) => setWorkScope(event.target.value === "studio" ? "studio" : "client")}>
                      <option value="client">{t.tasksUi.clientWork}</option>
                      <option value="studio">{t.tasksUi.studioWork}</option>
                    </Select>
                  </Field>
                )}
                {workScope === "client" ? (
                  <Field label={t.tasks.form.project}>
                    <Select name="project_id" required defaultValue={props.defaultProjectId ?? ""}>
                      <option value="">{t.tasks.form.noProject}</option>
                      {props.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.client_name ? `${p.client_name} — ${p.name}` : p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : <input type="hidden" name="project_id" value="" />}
              </>
            ) : (
              <>
                <input type="hidden" name="project_id" value={tk?.project_id ?? ""} />
                <input type="hidden" name="work_scope" value={tk?.work_scope ?? "client"} />
              </>
            )}

            {props.mode === "create" && templates.length > 0 && (
              <Field label={t.tasksUi.template}>
                <div className="flex items-center gap-2">
                  <Select
                    value={tpl?.id ?? ""}
                    onChange={(e) => {
                      const params = new URLSearchParams();
                      if (props.defaultProjectId)
                        params.set("projectId", props.defaultProjectId);
                      params.set("scope", workScope);
                      if (e.target.value)
                        params.set("templateId", e.target.value);
                      router.replace(
                        `${workScope === "studio" ? "/dashboard/studio-tasks/new" : "/dashboard/tasks/new"}${params.toString() ? "?" + params.toString() : ""}`,
                      );
                    }}
                  >
                    <option value="">{t.tasksUi.templateNone}</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </Select>
                  <Link
                    href="/dashboard/tasks/templates"
                    className="shrink-0 text-xs font-semibold text-brand hover:text-brand-dark"
                  >
                    {t.tasksUi.templateManage}
                  </Link>
                </div>
              </Field>
            )}

            <Field label={t.tasks.form.title} htmlFor="task-title">
              <Input
                id="task-title"
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
                <MultiAssignee
                  people={props.assignees.map((a) => ({
                    id: a.id,
                    label: a.full_name ?? `@${a.username}`,
                    avatar_url: a.avatar_url ?? null,
                  }))}
                  defaultSelected={tk?.assignee_ids ?? []}
                  emptyLabel={t.tasks.form.unassigned}
                />
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

            {props.canManagePayroll && (
              <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
                <p className="mb-3 text-sm font-semibold text-ink">Crédit points & salaire</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Type de production" htmlFor="payroll-task-type">
                    <Select id="payroll-task-type" name="payroll_task_type_id" defaultValue={tk?.payroll_task_type_id ?? ""}>
                      <option value="">Ne pas comptabiliser</option>
                      {(props.payrollTaskTypes ?? []).map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.label} · {type.output_points} pt · {(type.base_rate_millimes / 1000).toFixed(3)} DT
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Collaborateur crédité" htmlFor="payroll-credit-worker">
                    <Select id="payroll-credit-worker" name="payroll_credit_user_id" defaultValue={tk?.payroll_credit_user_id ?? ""}>
                      <option value="">Choisir…</option>
                      {(props.payrollWorkers ?? []).map((worker) => (
                        <option key={worker.id} value={worker.id}>{worker.full_name ?? `@${worker.username}`}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <p className="mt-2 text-xs text-content-3">Le crédit est créé une seule fois lorsque la tâche passe à Terminé. Seul un administrateur peut modifier ces champs.</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.tasks.form.status} htmlFor="task-status">
                <Select id="task-status" name="status" defaultValue={tk?.status ?? "todo"}>
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
              <Field label={t.tasksUi.tagsLabel}>
                <Input
                  name="tags"
                  placeholder={t.tags.placeholder}
                  defaultValue={(tk?.tags ?? []).join(", ")}
                />
                <p className="text-[11px] text-content-3">
                  {t.tasksUi.tagsHint}{" "}
                  <Link
                    href="/dashboard/tasks/tags"
                    className="font-semibold text-brand hover:text-brand-dark"
                  >
                    {t.tags.manageHint}
                  </Link>
                </p>
              </Field>
              <Field label={t.tasksUi.recurrence}>
                <Select
                  name="recurrence"
                  defaultValue={tk?.recurrence ?? ""}
                >
                  <option value="">{t.tasksUi.recurrenceNone}</option>
                  <option value="daily">{t.tasksUi.recurrenceDaily}</option>
                  <option value="weekly">{t.tasksUi.recurrenceWeekly}</option>
                  <option value="biweekly">
                    {t.tasksUi.recurrenceBiweekly}
                  </option>
                  <option value="monthly">{t.tasksUi.recurrenceMonthly}</option>
                </Select>
                <p className="text-[11px] text-content-3">
                  {t.tasksUi.recurrenceHint}
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.tasks.form.estimatedMinutes}>
                <Input
                  name="estimated_minutes"
                  type="number"
                  min="0"
                  step="15"
                  placeholder={t.tasks.form.estimatedMinutesPlaceholder}
                  defaultValue={tk?.estimated_minutes ?? ""}
                />
                <p className="text-[11px] text-content-3">
                  {t.tasks.form.estimatedMinutesHint}
                </p>
              </Field>
              {tk?.deadline && new Date(tk.deadline) < new Date() && tk.status !== "done" && (
                <Field label={t.tasks.form.lateReason}>
                  <Input
                    name="late_reason"
                    placeholder={t.tasks.form.lateReasonPlaceholder}
                    defaultValue={tk?.late_reason ?? ""}
                  />
                </Field>
              )}
            </div>

            {(tk?.status === "done" || tk?.status === "review") && (
              <Field label={t.tasks.form.completionNote}>
                <Textarea
                  name="completion_note"
                  rows={2}
                  placeholder={t.tasks.form.completionNotePlaceholder}
                  defaultValue={tk?.completion_note ?? ""}
                />
              </Field>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
            {saved && <p className="text-sm text-success">{t.common.saved}</p>}

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
                    ? workScope === "studio" ? "/dashboard/studio-tasks" : "/dashboard/tasks"
                    : `/dashboard/tasks/${tk?.id}`
                }
                className="text-sm text-content-3 hover:text-content-3"
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
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-content-3">{label}</label>
      {children}
    </div>
  );
}
