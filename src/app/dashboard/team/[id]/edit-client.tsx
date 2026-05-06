"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  updateTeamMemberAction,
  resetTeamMemberPasswordAction,
  deleteTeamMemberAction,
  uploadAvatarAction,
  removeAvatarAction,
} from "../actions";
import type { UserRole } from "@/lib/utils";

type Member = {
  id: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  email: string;
  avatar_url: string | null;
};

export function TeamEditClient({
  member,
  isSelf,
}: {
  member: Member;
  isSelf: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.full_name ?? member.username}
        subtitle={
          <Link href="/dashboard/team" className="hover:underline">
            ← {t.team.title}
          </Link>
        }
      />

      <AvatarCard member={member} />
      <ProfileForm member={member} isSelf={isSelf} />
      <PasswordResetCard memberId={member.id} />
      {!isSelf && <DeleteCard memberId={member.id} />}
    </div>
  );
}

function AvatarCard({ member }: { member: Member }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removePending, startRemove] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("id", member.id);
    fd.set("avatar", file);
    startTransition(async () => {
      const res = await uploadAvatarAction(fd);
      if (!res.ok) setError(res.error);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onRemove() {
    if (!confirm("Supprimer la photo de profil ?")) return;
    const fd = new FormData();
    fd.set("id", member.id);
    startRemove(async () => {
      await removeAvatarAction(fd);
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Photo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-5">
          <Avatar
            src={member.avatar_url}
            name={member.full_name ?? member.username}
            size="xl"
          />
          <div className="space-y-2">
            <label>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFile}
                disabled={pending}
              />
              <span
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
                role="button"
              >
                {pending ? "Téléversement…" : "Téléverser une image"}
              </span>
            </label>
            {member.avatar_url && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRemove}
                disabled={removePending}
              >
                {removePending ? "…" : "Retirer la photo"}
              </Button>
            )}
            <p className="text-xs text-ink/50">JPG, PNG ou WebP — 4 Mo max.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileForm({ member, isSelf }: { member: Member; isSelf: boolean }) {
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
      const res = await updateTeamMemberAction(fd);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{t.common.edit}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input type="hidden" name="id" value={member.id} />
          <Field label={t.team.columns.username}>
            <Input value={`@${member.username}`} disabled />
          </Field>
          <Field label={t.team.columns.email}>
            <Input value={member.email} disabled />
          </Field>
          <Field label={t.team.form.fullName}>
            <Input
              name="full_name"
              defaultValue={member.full_name ?? ""}
              required
            />
          </Field>
          <Field label={t.team.form.role}>
            <Select
              name="role"
              defaultValue={member.role}
              disabled={isSelf}
            >
              <option value="admin">{t.roles.admin}</option>
              <option value="worker">{t.roles.worker}</option>
              <option value="freelancer">{t.roles.freelancer}</option>
            </Select>
            {isSelf && (
              <p className="text-xs text-ink/50">
                {t.team.cannotChangeOwnRole}
              </p>
            )}
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-600">{t.common.saved}</p>}

          <div className="pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? t.common.saving : t.common.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordResetCard({ memberId }: { memberId: string }) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await resetTeamMemberPasswordAction(fd);
      if (!res.ok) setError(res.error);
      else {
        setDone(true);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{t.team.resetPassword}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input type="hidden" name="id" value={memberId} />
          <Field label={t.team.resetPasswordPrompt}>
            <Input
              name="password"
              type="text"
              minLength={8}
              required
              placeholder="MinimumHuit!"
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && (
            <p className="text-sm text-green-600">
              {t.team.resetPasswordSuccess}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? t.common.saving : t.team.resetPassword}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DeleteCard({ memberId }: { memberId: string }) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm(t.team.deleteConfirm)) return;
    setError(null);
    const fd = new FormData();
    fd.set("id", memberId);
    startTransition(async () => {
      const res = await deleteTeamMemberAction(fd);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <Card className="max-w-xl border-red-200">
      <CardHeader>
        <CardTitle className="text-red-700">{t.common.delete}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-ink/70">{t.team.deleteConfirm}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button
          type="button"
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={onClick}
          disabled={pending}
        >
          {pending ? t.common.saving : t.common.delete}
        </Button>
      </CardContent>
    </Card>
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
      <label className="text-sm font-medium text-ink/80">{label}</label>
      {children}
    </div>
  );
}
