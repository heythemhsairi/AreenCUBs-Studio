import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TaskForm } from "../task-form";
import { TaskDeleteButton } from "./delete-button";
import { SubtasksCard, type Subtask } from "./subtasks-client";
import { CommentsCard, type CommentRow } from "./comments-card";
import { FilesCard, type TaskFile } from "./files-card";
import { TimeTracker, type TimeEntry } from "./time-tracker";
import { ActivityFeed, type ActivityRow } from "./activity-feed";
import { PriorityPinButton } from "@/components/priority-pin-button";

export default async function TaskEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: task },
    { data: assignees },
    { data: subtasks },
    { data: commentsRaw },
    { data: filesRaw },
    { data: timeRaw },
    { data: activityRaw },
    { data: pinRow },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, project_id, title, description, status, priority, assignee_id, deadline, deliverable_url, parent_task_id, tags, recurrence, projects:project_id(name, clients:client_id(name))",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("id, username, full_name, role")
      .order("full_name"),
    supabase
      .from("tasks")
      .select("id, title, status")
      .eq("parent_task_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("task_comments")
      .select(
        "id, body, created_at, author_id, profiles:author_id(username, full_name, avatar_url)",
      )
      .eq("task_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("task_files")
      .select(
        "id, name, mime, size_bytes, created_at, uploaded_by, profiles:uploaded_by(username, full_name)",
      )
      .eq("task_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select(
        "id, started_at, ended_at, duration_seconds, user_id, profiles:user_id(username, full_name, avatar_url)",
      )
      .eq("task_id", id)
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("task_activity")
      .select(
        "id, action, meta, created_at, actor_id, profiles:actor_id(username, full_name, avatar_url)",
      )
      .eq("task_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("priority_pins")
      .select("id")
      .eq("task_id", id)
      .eq("user_id", session.id)
      .maybeSingle(),
  ]);

  if (!task) notFound();

  const project = Array.isArray(task.projects)
    ? task.projects[0]
    : task.projects;
  const client = project
    ? Array.isArray(project.clients)
      ? project.clients[0]
      : project.clients
    : null;

  const comments: CommentRow[] = (commentsRaw ?? []).map((c) => {
    const a = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    return {
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      author_id: c.author_id,
      author: a
        ? {
            username: a.username,
            full_name: a.full_name ?? null,
            avatar_url: a.avatar_url ?? null,
          }
        : null,
    };
  });

  const files: TaskFile[] = (filesRaw ?? []).map((f) => {
    const u = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
    return {
      id: f.id,
      name: f.name,
      mime: f.mime ?? null,
      size_bytes: f.size_bytes ?? null,
      created_at: f.created_at,
      uploaded_by: f.uploaded_by,
      uploader: u
        ? { username: u.username, full_name: u.full_name ?? null }
        : null,
    };
  });

  const timeEntries: TimeEntry[] = (timeRaw ?? []).map((e) => {
    const u = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    return {
      id: e.id,
      started_at: e.started_at,
      ended_at: e.ended_at,
      duration_seconds: e.duration_seconds,
      user: u
        ? {
            username: u.username,
            full_name: u.full_name ?? null,
            avatar_url: u.avatar_url ?? null,
          }
        : null,
    };
  });

  const myRunningEntryId =
    (timeRaw ?? []).find(
      (e) => e.ended_at === null && e.user_id === session.id,
    )?.id ?? null;

  const totalSeconds = timeEntries.reduce(
    (acc, e) => acc + (e.duration_seconds ?? 0),
    0,
  );

  const activity: ActivityRow[] = (activityRaw ?? []).map((a) => {
    const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
    return {
      id: a.id,
      action: a.action,
      meta: (a.meta as Record<string, unknown> | null) ?? null,
      created_at: a.created_at,
      actor: p
        ? {
            username: p.username,
            full_name: p.full_name ?? null,
            avatar_url: p.avatar_url ?? null,
          }
        : null,
    };
  });

  const isPinned = !!pinRow;

  return (
    <div className="space-y-6">
      {project && (
        <p className="text-xs text-ink/55">
          {client && <>{client.name} · </>}
          <Link
            href={`/dashboard/projects/${task.project_id}`}
            className="hover:underline"
          >
            {project.name}
          </Link>
        </p>
      )}

      <div className="flex items-center gap-3">
        <PriorityPinButton taskId={task.id} initiallyPinned={isPinned} />
        <span className="text-xs text-ink/55">
          {isPinned
            ? "Cette tâche fait partie de vos priorités du jour"
            : "Épingler dans mes priorités du jour"}
        </span>
      </div>

      <TaskForm
        mode="edit"
        task={task}
        assignees={assignees ?? []}
      />

      {!task.parent_task_id && (
        <TimeTracker
          taskId={task.id}
          entries={timeEntries}
          myRunningEntryId={myRunningEntryId}
          totalSeconds={totalSeconds}
        />
      )}

      {!task.parent_task_id && (
        <SubtasksCard
          parentId={task.id}
          initial={(subtasks ?? []) as Subtask[]}
        />
      )}

      <FilesCard
        taskId={task.id}
        initial={files}
        currentUserId={session.id}
        isAdmin={session.role === "admin"}
      />

      <CommentsCard
        taskId={task.id}
        initial={comments}
        currentUserId={session.id}
        isAdmin={session.role === "admin"}
      />

      <ActivityFeed entries={activity} />

      {session.role !== "freelancer" && (
        <TaskDeleteButton taskId={task.id} projectId={task.project_id} />
      )}
    </div>
  );
}
