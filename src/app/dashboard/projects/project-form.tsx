"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { MultiAssignee } from "@/components/multi-assignee";
import { createProjectAction, updateProjectAction } from "./actions";

type Member = {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  avatar_url?: string | null;
};

type Client = { id: string; name: string };

type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: "active" | "on_hold" | "completed" | "cancelled";
  owner_id: string | null;
  assignee_ids?: string[];
  start_date: string | null;
  end_date: string | null;
};

type Props =
  | {
      mode: "create";
      defaultClientId?: string;
      clients: Client[];
      potentialOwners: Member[];
      project?: undefined;
    }
  | {
      mode: "edit";
      project: ProjectRow;
      potentialOwners: Member[];
      clients?: undefined;
      defaultClientId?: undefined;
    };

export function ProjectForm(props: Props) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createProjectAction(fd)
          : await updateProjectAction(fd);
      if (res && !res.ok) setError(res.error);
      else if (res?.ok) setSaved(true);
    });
  }

  const p = props.mode === "edit" ? props.project : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          props.mode === "create"
            ? t.projects.addTitle
            : (p?.name ?? t.projects.title)
        }
        subtitle={
          <Link href="/dashboard/projects" className="hover:underline">
            ← {t.projects.title}
          </Link>
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            {props.mode === "create" ? t.common.create : t.common.edit}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {props.mode === "edit" && (
              <input type="hidden" name="id" value={p?.id} />
            )}

            {props.mode === "create" ? (
              <Field label="Client">
                <Select
                  name="client_id"
                  required
                  defaultValue={props.defaultClientId ?? ""}
                >
                  <option value="">— Choisir un client —</option>
                  {props.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="client_id" value={p?.client_id} />
            )}

            <Field label={t.projects.form.name}>
              <Input name="name" required defaultValue={p?.name ?? ""} />
            </Field>

            <Field label={t.projects.form.description}>
              <Textarea
                name="description"
                rows={3}
                defaultValue={p?.description ?? ""}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.projects.form.status}>
                <Select name="status" defaultValue={p?.status ?? "active"}>
                  <option value="active">{t.projects.status.active}</option>
                  <option value="on_hold">{t.projects.status.on_hold}</option>
                  <option value="completed">
                    {t.projects.status.completed}
                  </option>
                  <option value="cancelled">
                    {t.projects.status.cancelled}
                  </option>
                </Select>
              </Field>
              <Field label={t.projects.form.owner}>
                <Select name="owner_id" defaultValue={p?.owner_id ?? ""}>
                  <option value="">—</option>
                  {props.potentialOwners.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name ?? `@${m.username}`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label={t.projects.form.team}>
              <MultiAssignee
                people={props.potentialOwners.map((m) => ({
                  id: m.id,
                  label: m.full_name ?? `@${m.username}`,
                  avatar_url: m.avatar_url ?? null,
                }))}
                defaultSelected={p?.assignee_ids ?? []}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.projects.form.startDate}>
                <Input
                  name="start_date"
                  type="date"
                  defaultValue={p?.start_date ?? ""}
                />
              </Field>
              <Field label={t.projects.form.endDate}>
                <Input
                  name="end_date"
                  type="date"
                  defaultValue={p?.end_date ?? ""}
                />
              </Field>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && <p className="text-sm text-green-600">{t.common.saved}</p>}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={pending}>
                {pending
                  ? t.common.saving
                  : props.mode === "create"
                    ? t.common.create
                    : t.common.save}
              </Button>
              <Link
                href={
                  props.mode === "create"
                    ? "/dashboard/projects"
                    : `/dashboard/projects/${p?.id}`
                }
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                {t.common.cancel}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
