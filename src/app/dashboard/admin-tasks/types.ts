export type AdminTaskStatus = "todo" | "in_progress" | "waiting" | "done" | "cancelled";
export type AdminTaskPriority = "low" | "normal" | "high" | "urgent";

export type AdminTask = {
  id: string;
  title: string;
  description: string | null;
  status: AdminTaskStatus;
  priority: AdminTaskPriority;
  due_date: string | null;
  assigned_admin_id: string | null;
  assigned_admin_name: string | null;
  related_client_id: string | null;
  related_client_name: string | null;
  related_project_id: string | null;
  related_project_name: string | null;
  related_devis_id: string | null;
  related_devis_number: number | null;
  related_devis_kind: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const ADMIN_TASK_STATUSES: AdminTaskStatus[] = [
  "todo",
  "in_progress",
  "waiting",
  "done",
  "cancelled",
];

export const ADMIN_TASK_PRIORITIES: AdminTaskPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];
