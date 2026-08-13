import { requireInternal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STUDIO_SECTIONS } from "@/lib/studio-links";
import { MessagesClient, type StudioMessage, type StudioPerson, type StudioReminder, type StudioTaskOption } from "./messages-client";

export default async function MessagesPage() {
  const session = await requireInternal();
  const supabase = await createClient();

  const [
    { data: messagesRaw },
    { data: recipientsRaw },
    { data: peopleRaw },
    { data: tasksRaw },
    { data: remindersRaw },
  ] = await Promise.all([
    supabase
      .from("studio_messages")
      .select("id, sender_id, body, task_id, section_path, section_label, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("studio_message_recipients")
      .select("message_id, user_id, read_at"),
    supabase
      .from("studio_member_directory")
      .select("id, username, full_name, role, avatar_url, job_title")
      .order("full_name"),
    supabase
      .from("tasks")
      .select("id, title, work_scope")
      .is("parent_task_id", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("reminders")
      .select("id, title, remind_at, link, completed_at, created_at")
      .is("completed_at", null)
      .order("remind_at", { ascending: true })
      .limit(50),
  ]);

  const people = (peopleRaw ?? []) as StudioPerson[];
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const tasks = (tasksRaw ?? []) as StudioTaskOption[];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const recipientRows = (recipientsRaw ?? []) as { message_id: string; user_id: string; read_at: string | null }[];
  const recipientsByMessage = new Map<string, typeof recipientRows>();
  for (const recipient of recipientRows) {
    const current = recipientsByMessage.get(recipient.message_id) ?? [];
    current.push(recipient);
    recipientsByMessage.set(recipient.message_id, current);
  }

  const messages: StudioMessage[] = (messagesRaw ?? []).map((message) => ({
    ...message,
    sender: peopleById.get(message.sender_id) ?? null,
    task: message.task_id ? tasksById.get(message.task_id) ?? null : null,
    recipients: (recipientsByMessage.get(message.id) ?? [])
      .map((recipient) => ({
        ...recipient,
        person: peopleById.get(recipient.user_id) ?? null,
      })),
  }));

  return (
    <MessagesClient
      currentUserId={session.id}
      currentRole={session.role}
      messages={messages}
      people={people.filter((person) => person.id !== session.id)}
      tasks={tasks}
      reminders={(remindersRaw ?? []) as StudioReminder[]}
      sections={STUDIO_SECTIONS.map((section) => ({
        path: section.path,
        labelFr: section.labelFr,
        labelEn: section.labelEn,
      }))}
    />
  );
}
