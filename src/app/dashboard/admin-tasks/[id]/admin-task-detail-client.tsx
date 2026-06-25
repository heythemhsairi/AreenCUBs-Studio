"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { formatDate, formatDevisNumber } from "@/lib/format";
import { changeAdminTaskStatusAction, deleteAdminTaskAction } from "../actions";
import { toast } from "@/components/toast";
import { AdminTaskForm } from "../admin-task-form";
import type { AdminTask } from "../types";
import { ADMIN_TASK_STATUSES } from "../types";
import { ArrowLeft, Pencil, Trash2, Loader2, Check } from "lucide-react";

type SelectOption = { id: string; name?: string; full_name?: string; number?: number; kind?: string };

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start">
      <span className="w-36 shrink-0 text-xs font-semibold text-[var(--c-text-3)]">{label}</span>
      <span className="text-sm text-[var(--c-text-1)]">{children}</span>
    </div>
  );
}

export function AdminTaskDetailClient({
  task: initialTask,
  admins,
  clients,
  projects,
  devisList,
}: {
  task: AdminTask;
  admins: SelectOption[];
  clients: SelectOption[];
  projects: SelectOption[];
  devisList: SelectOption[];
}) {
  const { t } = useI18n();
  const at = t.adminTasks;
  const router = useRouter();
  const [task, setTask] = useState<AdminTask>(initialTask);
  const [editing, setEditing] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();

  function handleStatusChange(next: string) {
    const prev = task.status;
    setTask((t) => ({ ...t, status: next as AdminTask["status"] }));
    startStatusTransition(async () => {
      const res = await changeAdminTaskStatusAction(task.id, next);
      if (!res.ok) {
        setTask((t) => ({ ...t, status: prev }));
        toast.error(res.error);
      } else {
        toast.success(t.common.saved);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(at.deleteConfirm)) return;
    startDeleteTransition(async () => {
      const res = await deleteAdminTaskAction(task.id);
      if (!res.ok) toast.error(res.error);
      // on success, deleteAdminTaskAction redirects to list
    });
  }

  if (editing) {
    return (
      <AdminTaskForm
        task={task}
        admins={admins}
        clients={clients}
        projects={projects}
        devisList={devisList}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/admin-tasks"
          className="flex items-center gap-1.5 text-sm text-[var(--c-text-3)] hover:text-[var(--c-text-1)] transition-colors"
        >
          <ArrowLeft size={14} />
          {at.backToList}
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--c-text-2)] hover:text-[var(--c-text-1)] transition-colors"
          >
            <Pencil size={12} />
            {t.common.edit}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deletePending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#F43F5E]/30 bg-[#F43F5E]/10 px-3 py-1.5 text-xs font-medium text-[#F43F5E] hover:bg-[#F43F5E]/20 transition-colors disabled:opacity-50"
          >
            {deletePending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {at.delete}
          </button>
        </div>
      </div>

      {/* Title + badges */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--c-text-1)]">{task.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} type="task" />
          <PriorityBadge priority={task.priority} />
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-4">
          <p className="whitespace-pre-wrap text-sm text-[var(--c-text-2)]">{task.description}</p>
        </div>
      )}

      {/* Details card */}
      <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] p-5 space-y-3">
        <DetailRow label={at.labelDueDate}>
          {task.due_date ? formatDate(task.due_date) : "—"}
        </DetailRow>
        <DetailRow label={at.labelAssignedTo}>
          {task.assigned_admin_name ?? "—"}
        </DetailRow>
        {task.related_client_name && (
          <DetailRow label={at.labelRelatedClient}>
            <Link
              href={`/dashboard/clients/${task.related_client_id}`}
              className="text-[#22D3EE] hover:underline"
            >
              {task.related_client_name}
            </Link>
          </DetailRow>
        )}
        {task.related_project_name && (
          <DetailRow label={at.labelRelatedProject}>
            <Link
              href={`/dashboard/projects/${task.related_project_id}`}
              className="text-[#22D3EE] hover:underline"
            >
              {task.related_project_name}
            </Link>
          </DetailRow>
        )}
        {task.related_devis_number != null && (
          <DetailRow label={at.labelRelatedDevis}>
            <Link
              href={`/dashboard/devis/${task.related_devis_id}`}
              className="text-[#22D3EE] hover:underline"
            >
              {formatDevisNumber(task.related_devis_number, task.related_devis_kind as "devis" | "facture")}
            </Link>
          </DetailRow>
        )}
        <DetailRow label={at.labelStatus}>
          <select
            value={task.status}
            disabled={statusPending}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="cursor-pointer rounded-lg border border-[var(--c-border)] bg-[var(--c-elevated)] px-2 py-1 text-xs text-[var(--c-text-2)] focus:outline-none focus:border-[#22D3EE] disabled:opacity-50"
          >
            {ADMIN_TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{at.status[s]}</option>
            ))}
          </select>
        </DetailRow>
      </div>

      {/* Timestamps */}
      <p className="text-[10px] text-[var(--c-text-3)]">
        {formatDate(task.created_at)} · {formatDate(task.updated_at)}
      </p>
    </div>
  );
}
