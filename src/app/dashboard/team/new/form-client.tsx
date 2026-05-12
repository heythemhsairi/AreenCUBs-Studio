"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { createTeamMemberAction } from "../actions";

export function TeamNewClient() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createTeamMemberAction(formData);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.team.addTitle}
        subtitle={
          <Link href="/dashboard/team" className="hover:underline">
            ← {t.team.title}
          </Link>
        }
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t.team.addTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Field label={t.team.form.username} hint={t.team.form.usernameHint}>
              <Input
                name="username"
                required
                autoCapitalize="none"
                placeholder="ala"
              />
            </Field>
            <Field label={t.team.form.fullName}>
              <Input name="full_name" required placeholder="Ala Ben Aïcha" />
            </Field>
            <Field label={t.team.form.password} hint={t.team.form.passwordHint}>
              <Input
                name="password"
                type="text"
                required
                minLength={8}
                placeholder="MinimumHuit!"
              />
            </Field>
            <Field label={t.team.form.role}>
              <Select name="role" defaultValue="worker">
                <option value="admin">{t.roles.admin}</option>
                <option value="worker">{t.roles.worker}</option>
                <option value="freelancer">{t.roles.freelancer}</option>
              </Select>
            </Field>
            <Field label="Titre / poste (optionnel)">
              <Input
                name="job_title"
                placeholder="Ex. Graphic Designer / Editor"
              />
            </Field>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={pending}>
                {pending ? t.common.saving : t.common.create}
              </Button>
              <Link
                href="/dashboard/team"
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
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
