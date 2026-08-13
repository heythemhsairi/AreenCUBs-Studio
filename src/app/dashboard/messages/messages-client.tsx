"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Bell, Check, Clock3, Link2, MessageCircle, Reply, Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/toast";
import { useI18n } from "@/lib/i18n/provider";
import { collaborationWelcome } from "@/lib/role-copy";
import type { UserRole } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { completeReminderAction, createReminderAction, deleteReminderAction, deleteStudioMessageAction, markStudioMessagesReadAction, sendStudioMessageAction } from "./actions";

export type StudioPerson = {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  job_title: string | null;
};

export type StudioTaskOption = {
  id: string;
  title: string;
  work_scope: "client" | "studio";
};

export type StudioMessage = {
  id: string;
  sender_id: string;
  body: string;
  task_id: string | null;
  section_path: string | null;
  section_label: string | null;
  created_at: string;
  sender: StudioPerson | null;
  task: StudioTaskOption | null;
  recipients: Array<{
    message_id: string;
    user_id: string;
    read_at: string | null;
    person: StudioPerson | null;
  }>;
};

export type StudioReminder = {
  id: string;
  title: string;
  remind_at: string;
  link: string | null;
  completed_at: string | null;
  created_at: string;
};

type SectionOption = { path: string; labelFr: string; labelEn: string };
type FeedFilter = "all" | "inbox" | "sent";

export function MessagesClient({
  currentUserId,
  currentRole,
  messages,
  people,
  tasks,
  reminders,
  sections,
}: {
  currentUserId: string;
  currentRole: UserRole;
  messages: StudioMessage[];
  people: StudioPerson[];
  tasks: StudioTaskOption[];
  reminders: StudioReminder[];
  sections: SectionOption[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const composerRef = useRef<HTMLDivElement>(null);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [sending, startSending] = useTransition();
  const [reminderPending, startReminder] = useTransition();

  const unreadIds = useMemo(
    () => messages
      .filter((message) => message.sender_id !== currentUserId && message.recipients.some((recipient) => recipient.user_id === currentUserId && !recipient.read_at))
      .map((message) => message.id),
    [messages, currentUserId],
  );

  useEffect(() => {
    if (unreadIds.length === 0) return;
    void markStudioMessagesReadAction(unreadIds);
  }, [unreadIds]);

  const visibleMessages = messages.filter((message) => {
    if (feedFilter === "sent") return message.sender_id === currentUserId;
    if (feedFilter === "inbox") return message.sender_id !== currentUserId;
    return true;
  });

  function togglePerson(id: string) {
    setSelectedPeople((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function prepareReply(personId: string) {
    if (personId === currentUserId) return;
    setSelectedPeople([personId]);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    for (const id of selectedPeople) formData.append("recipient_ids", id);
    startSending(async () => {
      const result = await sendStudioMessageAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form.reset();
      setSelectedPeople([]);
      toast.success(t.messages.sent);
      router.refresh();
    });
  }

  function submitReminder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    startReminder(async () => {
      const result = await createReminderAction(new FormData(form));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form.reset();
      toast.success(t.messages.reminderSaved);
      router.refresh();
    });
  }

  function completeReminder(id: string) {
    startReminder(async () => {
      const result = await completeReminderAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function removeReminder(id: string) {
    startReminder(async () => {
      const result = await deleteReminderAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function removeMessage(id: string) {
    startSending(async () => {
      const result = await deleteStudioMessageAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t.messages.title} description={t.messages.description} />

      <div className="rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/10 to-info/5 px-5 py-4">
        <p className="text-sm font-semibold text-content">{t.messages.welcome}</p>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-content-2">{collaborationWelcome(currentRole, locale)}</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t.messages.newMessage}</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={composerRef} className="scroll-mt-24">
                <form className="space-y-4" onSubmit={submitMessage}>
                  <div>
                    <label htmlFor="studio-message-body" className="text-sm font-medium text-content-2">{t.messages.message}</label>
                    <Textarea id="studio-message-body" name="body" rows={4} maxLength={4000} required placeholder={t.messages.messagePlaceholder} className="mt-1.5" />
                  </div>

                  <fieldset>
                    <legend className="text-sm font-medium text-content-2">{t.messages.mentionPeople}</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {people.map((person) => {
                        const selected = selectedPeople.includes(person.id);
                        return (
                          <button
                            key={person.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => togglePerson(person.id)}
                            className={cn("inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors", selected ? "border-brand bg-brand text-white" : "border-line bg-surface-2 text-content-2 hover:border-brand/40")}
                          >
                            <Avatar src={person.avatar_url} name={person.full_name ?? person.username} size="xs" />
                            @{person.username}
                            {selected ? <Check size={13} aria-hidden /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-content-2">
                      {t.messages.linkTask}
                      <Select name="task_id" defaultValue="" className="mt-1.5">
                        <option value="">{t.messages.noLink}</option>
                        {tasks.map((task) => <option key={task.id} value={task.id}>{task.work_scope === "studio" ? "Areen" : "Client"} · {task.title}</option>)}
                      </Select>
                    </label>
                    <label className="text-sm font-medium text-content-2">
                      {t.messages.linkSection}
                      <Select name="section_path" defaultValue="" className="mt-1.5">
                        <option value="">{t.messages.noLink}</option>
                        {sections.map((section) => <option key={section.path} value={section.path}>{locale === "en" ? section.labelEn : section.labelFr}</option>)}
                      </Select>
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={sending || selectedPeople.length === 0}>
                      <Send size={15} aria-hidden /> {sending ? t.messages.sending : t.messages.send}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>

          <section aria-labelledby="message-feed-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="message-feed-title" className="text-lg font-semibold text-content">{t.messages.feed}</h2>
              <div className="flex rounded-lg border border-line bg-surface p-1" role="group" aria-label={t.messages.feedFilter}>
                {(["all", "inbox", "sent"] as const).map((filter) => (
                  <button key={filter} type="button" aria-pressed={feedFilter === filter} onClick={() => setFeedFilter(filter)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", feedFilter === filter ? "bg-brand text-white" : "text-content-3 hover:bg-surface-2")}>{t.messages.filters[filter]}</button>
                ))}
              </div>
            </div>

            {visibleMessages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface/50 px-5 py-12 text-center">
                <MessageCircle className="mx-auto h-7 w-7 text-brand" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-content">{t.messages.empty}</p>
                <p className="mt-1 text-xs text-content-3">{t.messages.emptyHint}</p>
              </div>
            ) : visibleMessages.map((message) => (
              <MessageCard key={message.id} message={message} currentUserId={currentUserId} locale={locale} sections={sections} onReply={prepareReply} onDelete={removeMessage} labels={t.messages} />
            ))}
          </section>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t.messages.newReminder}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={submitReminder}>
                <label className="block text-sm font-medium text-content-2">
                  {t.messages.reminderTitle}
                  <Input name="title" required maxLength={240} placeholder={t.messages.reminderPlaceholder} className="mt-1.5" />
                </label>
                <label className="block text-sm font-medium text-content-2">
                  {t.messages.remindAt}
                  <Input name="remind_at" type="datetime-local" required className="mt-1.5" />
                </label>
                <label className="block text-sm font-medium text-content-2">
                  {t.messages.linkTask}
                  <Select name="task_id" defaultValue="" className="mt-1.5">
                    <option value="">{t.messages.noLink}</option>
                    {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                  </Select>
                </label>
                <label className="block text-sm font-medium text-content-2">
                  {t.messages.linkSection}
                  <Select name="section_path" defaultValue="" className="mt-1.5">
                    <option value="">{t.messages.noLink}</option>
                    {sections.map((section) => <option key={section.path} value={section.path}>{locale === "en" ? section.labelEn : section.labelFr}</option>)}
                  </Select>
                </label>
                <Button type="submit" disabled={reminderPending} className="w-full"><Bell size={15} aria-hidden /> {t.messages.saveReminder}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t.messages.myReminders}</CardTitle></CardHeader>
            <CardContent>
              {reminders.length === 0 ? <p className="text-sm text-content-3">{t.messages.noReminders}</p> : (
                <ul className="space-y-2">
                  {reminders.map((reminder) => (
                    <li key={reminder.id} className="rounded-xl border border-line bg-surface-2 p-3">
                      <div className="flex items-start gap-2">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                        <div className="min-w-0 flex-1">
                          {reminder.link ? <Link href={reminder.link} className="text-sm font-semibold text-content hover:text-brand">{reminder.title}</Link> : <p className="text-sm font-semibold text-content">{reminder.title}</p>}
                          <p className="mt-1 text-xs text-content-3">{formatDateTime(reminder.remind_at, locale)}</p>
                        </div>
                        <button type="button" onClick={() => completeReminder(reminder.id)} aria-label={t.messages.completeReminder} className="rounded-md p-1.5 text-success hover:bg-success-weak"><Check size={15} /></button>
                        <button type="button" onClick={() => removeReminder(reminder.id)} aria-label={t.messages.deleteReminder} className="rounded-md p-1.5 text-content-3 hover:bg-danger-weak hover:text-danger"><Trash2 size={15} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function MessageCard({ message, currentUserId, locale, sections, onReply, onDelete, labels }: { message: StudioMessage; currentUserId: string; locale: "fr" | "en"; sections: SectionOption[]; onReply: (personId: string) => void; onDelete: (messageId: string) => void; labels: ReturnType<typeof useI18n>["t"]["messages"] }) {
  const mine = message.sender_id === currentUserId;
  const section = sections.find((item) => item.path === message.section_path);
  return (
    <article id={`message-${message.id}`} className={cn("scroll-mt-24 rounded-2xl border p-4", mine ? "border-brand/20 bg-brand/5" : "border-line bg-surface")}>
      <div className="flex items-start gap-3">
        <Avatar src={message.sender?.avatar_url ?? null} name={message.sender?.full_name ?? message.sender?.username ?? "?"} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button type="button" onClick={() => onReply(message.sender_id)} className="text-sm font-semibold text-content hover:text-brand">{message.sender?.full_name ?? `@${message.sender?.username ?? "membre"}`}</button>
            <span className="text-xs text-content-3">{formatDateTime(message.created_at, locale)}</span>
            {mine ? <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">{labels.you}</span> : null}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-content-2">{message.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {message.recipients.map((recipient) => recipient.person ? (
              <button key={recipient.user_id} type="button" onClick={() => onReply(recipient.user_id)} className="inline-flex items-center gap-1 rounded-full bg-info-weak px-2.5 py-1 text-xs font-semibold text-info"><AtSign size={12} aria-hidden />{recipient.person.username}</button>
            ) : null)}
            {message.task ? <Link href={`/dashboard/tasks/${message.task.id}`} className="inline-flex items-center gap-1 rounded-full bg-warning-weak px-2.5 py-1 text-xs font-semibold text-warning"><Link2 size={12} aria-hidden />{message.task.title}</Link> : null}
            {message.section_path ? <Link href={message.section_path} className="inline-flex items-center gap-1 rounded-full bg-success-weak px-2.5 py-1 text-xs font-semibold text-success"><Link2 size={12} aria-hidden />{section ? locale === "en" ? section.labelEn : section.labelFr : message.section_label}</Link> : null}
          </div>
        </div>
        {!mine ? <button type="button" onClick={() => onReply(message.sender_id)} aria-label={labels.reply} className="rounded-lg p-2 text-content-3 hover:bg-surface-2 hover:text-brand"><Reply size={16} /></button> : <button type="button" onClick={() => onDelete(message.id)} aria-label={labels.deleteMessage} className="rounded-lg p-2 text-content-3 hover:bg-danger-weak hover:text-danger"><Trash2 size={16} /></button>}
      </div>
    </article>
  );
}

function formatDateTime(value: string, locale: "fr" | "en") {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  }).format(new Date(value));
}
