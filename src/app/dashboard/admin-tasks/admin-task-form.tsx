"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { createAdminTaskAction, updateAdminTaskAction } from "./actions";
import { toast } from "@/components/toast";
import { ADMIN_TASK_STATUSES, ADMIN_TASK_PRIORITIES } from "./types";
import type { AdminTask } from "./types";
import { ArrowLeft, Loader2 } from "lucide-react";
import { formatDevisNumber } from "@/lib/format";

type SelectOption = { id: string; name?: string; full_name?: string; number?: number; kind?: string };

export function AdminTaskForm({
  task,
  admins,
  clients,
  projects,
  devisList,
}: {
  task?: AdminTask;
  admins: SelectOption[];
  clients: SelectOption[];
  projects: SelectOption[];
  devisList: SelectOption[];
}) {
  const { t } = useI18n();
  const at = t.adminTasks;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!task;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const action = isEdit ? updateAdminTaskAction : createAdminTaskAction;
      const res = await action(fd);
      if ("ok" in res && !res.ok) {
        toast.error(res.error);
      } else if (!isEdit) {
        // createAdminTaskAction redirects on success — no extra nav needed
      } else {
        toast.success(t.common.saved);
        router.push(`/dashboard/admin-tasks/${task!.id}`);
      }
    });
  }

  const labelCls = "block text-xs font-semibold text-[var(--c-text-2)] mb-1";
  const inputCls =
    "w-full rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-2 text-sm text-[var(--c-text-1)] placeholder:text-[var(--c-text-3)] focus:outline-none focus:border-[#22D3EE] disabled:opacity-50";
  const selectCls = inputCls;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={isEdit ? `/dashboard/admin-tasks/${task!.id}` : "/dashboard/admin-tasks"}
          className="flex items-center gap-1.5 text-sm text-[var(--c-text-3)] hover:text-[var(--c-text-1)] transition-colors"
        >
          <ArrowLeft size={14} />
          {at.backToList}
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[var(--c-text-1)]">
          {isEdit ? at.editTitle : at.newTitle}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {isEdit && <input type="hidden" name="id" value={task!.id} />}

        {/* Title */}
        <div>
          <label htmlFor="at-title" className={labelCls}>
            {at.labelTitle} <span className="text-[#F43F5E]">*</span>
          </label>
          <input
            id="at-title"
            name="title"
            type="text"
            required
            defaultValue={task?.title ?? ""}
            placeholder={at.labelTitle}
            className={inputCls}
            disabled={pending}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="at-desc" className={labelCls}>
            {at.labelDescription}
          </label>
          <textarea
            id="at-desc"
            name="description"
            rows={4}
            defaultValue={task?.description ?? ""}
            placeholder={at.labelDescription + "…"}
            className={inputCls}
            disabled={pending}
          />
        </div>

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="at-status" className={labelCls}>{at.labelStatus}</label>
            <select
              id="at-status"
              name="status"
              defaultValue={task?.status ?? "todo"}
              className={selectCls}
              disabled={pending}
            >
              {ADMIN_TASK_STATUSES.map((s) => (
                <option key={s} value={s}>{at.status[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="at-priority" className={labelCls}>{at.labelPriority}</label>
            <select
              id="at-priority"
              name="priority"
              defaultValue={task?.priority ?? "normal"}
              className={selectCls}
              disabled={pending}
            >
              {ADMIN_TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>{at.priority[p]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Due date */}
        <div>
          <label htmlFor="at-due" className={labelCls}>{at.labelDueDate}</label>
          <input
            id="at-due"
            name="due_date"
            type="date"
            defaultValue={task?.due_date?.slice(0, 10) ?? ""}
            className={inputCls}
            disabled={pending}
          />
        </div>

        {/* Assigned admin */}
        <div>
          <label htmlFor="at-admin" className={labelCls}>{at.labelAssignedTo}</label>
          <select
            id="at-admin"
            name="assigned_admin_id"
            defaultValue={task?.assigned_admin_id ?? ""}
            className={selectCls}
            disabled={pending}
          >
            <option value="">{at.noRelated}</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
        </div>

        {/* Related client */}
        <div>
          <label htmlFor="at-client" className={labelCls}>{at.labelRelatedClient}</label>
          <select
            id="at-client"
            name="related_client_id"
            defaultValue={task?.related_client_id ?? ""}
            className={selectCls}
            disabled={pending}
          >
            <option value="">{at.noRelated}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Related project */}
        <div>
          <label htmlFor="at-project" className={labelCls}>{at.labelRelatedProject}</label>
          <select
            id="at-project"
            name="related_project_id"
            defaultValue={task?.related_project_id ?? ""}
            className={selectCls}
            disabled={pending}
          >
            <option value="">{at.noRelated}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Related devis */}
        <div>
          <label htmlFor="at-devis" className={labelCls}>{at.labelRelatedDevis}</label>
          <select
            id="at-devis"
            name="related_devis_id"
            defaultValue={task?.related_devis_id ?? ""}
            className={selectCls}
            disabled={pending}
          >
            <option value="">{at.noRelated}</option>
            {devisList.map((d) => (
              <option key={d.id} value={d.id}>
                {formatDevisNumber(d.number!, d.kind as "devis" | "facture")}
              </option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/30 px-5 py-2.5 text-sm font-semibold text-[#22D3EE] hover:bg-[#22D3EE]/20 transition-colors disabled:opacity-50"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {at.save}
          </button>
          <Link
            href={isEdit ? `/dashboard/admin-tasks/${task!.id}` : "/dashboard/admin-tasks"}
            className="text-sm text-[var(--c-text-3)] hover:text-[var(--c-text-1)] transition-colors"
          >
            {t.common.cancel}
          </Link>
        </div>
      </form>
    </div>
  );
}
