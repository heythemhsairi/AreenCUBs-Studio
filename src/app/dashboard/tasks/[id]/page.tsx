import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TaskForm } from "../task-form";
import { TaskDeleteButton } from "./delete-button";
import { SubtasksCard, type Subtask } from "./subtasks-client";
import { CommentsCard, type CommentRow } from "./comments-card";
import { FilesCard, type TaskFile } from "./files-card";

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
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, project_id, title, description, status, priority, assignee_id, deadline, deliverable_url, parent_task_id, projects:project_id(name, clients:client_id(name))",
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

      <TaskForm
        mode="edit"
        task={task}
        assignees={assignees ?? []}
      />

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

      {session.role !== "freelancer" && (
        <TaskDeleteButton taskId={task.id} projectId={task.project_id} />
      )}
    </div>
  );
}
