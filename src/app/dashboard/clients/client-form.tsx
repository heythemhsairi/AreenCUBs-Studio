"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { createClientAction, updateClientAction } from "./actions";

type ClientRow = {
  id: string;
  name: string;
  address: string | null;
  matricule_fiscal: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

type Props =
  | { mode: "create"; client?: undefined }
  | { mode: "edit"; client: ClientRow };

export function ClientForm(props: Props) {
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
          ? await createClientAction(fd)
          : await updateClientAction(fd);
      if (res && !res.ok) setError(res.error);
      else if (res?.ok) setSaved(true);
    });
  }

  const c = props.mode === "edit" ? props.client : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          props.mode === "create"
            ? t.clients.addTitle
            : (c?.name ?? t.clients.title)
        }
        subtitle={
          <Link href="/dashboard/clients" className="hover:underline">
            ← {t.clients.title}
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
              <input type="hidden" name="id" value={c?.id} />
            )}
            <Field label={t.clients.form.name}>
              <Input name="name" required defaultValue={c?.name ?? ""} />
            </Field>
            <Field label={t.clients.form.address}>
              <Textarea
                name="address"
                rows={2}
                defaultValue={c?.address ?? ""}
              />
            </Field>
            <Field label={t.clients.form.matriculeFiscal}>
              <Input
                name="matricule_fiscal"
                defaultValue={c?.matricule_fiscal ?? ""}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.clients.form.email}>
                <Input
                  name="email"
                  type="email"
                  defaultValue={c?.email ?? ""}
                />
              </Field>
              <Field label={t.clients.form.phone}>
                <Input name="phone" defaultValue={c?.phone ?? ""} />
              </Field>
            </div>
            <Field label={t.clients.form.notes}>
              <Textarea
                name="notes"
                rows={3}
                defaultValue={c?.notes ?? ""}
              />
            </Field>

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
                    ? "/dashboard/clients"
                    : `/dashboard/clients/${c?.id}`
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
