import { createClient } from "@/lib/supabase/server";
import { InternDashboardClient, type InternTask } from "./intern-client";
import type { SessionProfile } from "@/lib/auth";
import { toBusinessDateKey } from "@/lib/format";

/**
 * The intern dashboard.
 *
 * Reached by an early return in the dashboard page, for the same reason as the
 * commercial one: the surest way not to show agency finance is never to query
 * it.
 *
 * The matrix places an intern strictly below a worker — assigned tasks, the
 * projects those live in, and a reduced view of the clients behind them.
 * Nothing about money, contracts, colleagues' workloads or internal client
 * notes.
 *
 * Client names come from `client_directory`, NOT `public.clients`. That is not
 * a stylistic choice: an intern holds no policy on the clients table at all,
 * because RLS is row-level and the row carries `notes` — the agency's private
 * commentary about the client. The view exposes four safe columns and the
 * table stays unreachable. See docs/audit/PERMISSION-MATRIX.md §2.
 */
export async function InternDashboard({ session }: { session: SessionProfile }) {
  const supabase = await createClient();

  const [tasksRes, projectsRes, directoryRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, priority, deadline, project_id")
      .order("deadline", { ascending: true, nullsFirst: false }),
    supabase.from("projects").select("id, name, client_id"),
    supabase.from("client_directory").select("id, name"),
  ]);

  const loadError =
    tasksRes.error?.message ?? projectsRes.error?.message ?? directoryRes.error?.message ?? null;

  const clientNameById = new Map((directoryRes.data ?? []).map((c) => [c.id, c.name]));
  const projectById = new Map(
    (projectsRes.data ?? []).map((p) => [
      p.id,
      { name: p.name, clientName: clientNameById.get(p.client_id) ?? null },
    ]),
  );

  // Overdue is resolved on the server and passed down as a boolean. Comparing
  // dates in the browser would put a UTC server render against an Africa/Tunis
  // client clock — the asymmetry that caused this project's #418 errors.
  const todayKey = toBusinessDateKey(new Date()) ?? "";

  const tasks: InternTask[] = (tasksRes.data ?? []).map((t) => {
    const project = projectById.get(t.project_id);
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      deadline: t.deadline,
      overdue: t.deadline !== null && t.deadline < todayKey && t.status !== "done",
      projectName: project?.name ?? null,
      clientName: project?.clientName ?? null,
    };
  });

  return (
    <InternDashboardClient
      firstName={(session.full_name ?? session.username).split(" ")[0]}
      tasks={tasks}
      loadError={loadError}
    />
  );
}
