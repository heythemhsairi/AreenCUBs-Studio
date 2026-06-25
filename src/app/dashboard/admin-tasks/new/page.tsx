import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminTaskForm } from "../admin-task-form";

export const metadata = { title: "New Admin Task" };

export default async function NewAdminTaskPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: admins }, { data: clients }, { data: projects }, { data: devisList }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "admin").order("full_name"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("devis").select("id, number, kind").order("number", { ascending: false }).limit(100),
    ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AdminTaskForm
        admins={admins ?? []}
        clients={clients ?? []}
        projects={projects ?? []}
        devisList={devisList ?? []}
      />
    </div>
  );
}
