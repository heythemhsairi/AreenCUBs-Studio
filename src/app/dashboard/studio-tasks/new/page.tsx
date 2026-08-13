import { requireWorkerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TaskForm, type TaskTemplateOption } from "../../tasks/task-form";

export default async function NewStudioTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const session = await requireWorkerOrAdmin();
  const { templateId } = await searchParams;
  const supabase = await createClient();

  const [{ data: members }, { data: templates }] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, role, avatar_url").order("full_name"),
    supabase.from("task_templates").select("id, name, title, description, priority, default_deadline_offset_days").order("name"),
  ]);

  const templateOptions: TaskTemplateOption[] = (templates ?? []).map((template) => ({
    id: template.id,
    name: template.name,
    title: template.title,
    description: template.description,
    priority: template.priority,
    default_deadline_offset_days: template.default_deadline_offset_days,
  }));

  const [{ data: payrollTaskTypes }, { data: payrollSettings }] =
    session.role === "admin"
      ? await Promise.all([
          supabase.from("payroll_task_types").select("id, label, base_rate_millimes, output_points").eq("active", true).order("position"),
          supabase.from("payroll_worker_settings").select("user_id, profiles:user_id(id, username, full_name)").eq("active", true),
        ])
      : [{ data: [] }, { data: [] }];

  const payrollWorkers = (payrollSettings ?? []).flatMap((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return profile ? [profile] : [];
  });

  return (
    <TaskForm
      mode="create"
      currentRole={session.role}
      defaultScope="studio"
      scopeLocked
      projects={[]}
      assignees={members ?? []}
      templates={templateOptions}
      preselectedTemplate={templateId ? templateOptions.find((template) => template.id === templateId) ?? null : null}
      canManagePayroll={session.role === "admin"}
      payrollTaskTypes={payrollTaskTypes ?? []}
      payrollWorkers={payrollWorkers}
    />
  );
}
