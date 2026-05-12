"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  updateMyProfileAction,
  uploadMyAvatarAction,
  removeMyAvatarAction,
  changeMyPasswordAction,
} from "./actions";
import type { UserRole } from "@/lib/utils";

type Profile = {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
};

const roleTone: Record<UserRole, "violet" | "blue" | "green"> = {
  admin: "violet",
  worker: "blue",
  freelancer: "green",
};

const roleLabel: Record<UserRole, string> = {
  admin: "Administrateur",
  worker: "Collaborateur",
  freelancer: "Freelance",
};

export function ProfileClient({ profile }: { profile: Profile }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Mon profil" subtitle="Gérez vos informations" />

      <ProfileSummary profile={profile} />
      <NameForm initial={profile.full_name ?? ""} />
      <PasswordForm />
    </div>
  );
}

function ProfileSummary({ profile }: { profile: Profile }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removePending, startRemove] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("avatar", file);
    startTransition(async () => {
      const res = await uploadMyAvatarAction(fd);
      if (!res.ok) setError(res.error);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onRemove() {
    if (!confirm("Supprimer votre photo de profil ?")) return;
    startRemove(async () => {
      await removeMyAvatarAction();
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Photo &amp; identité</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <Avatar
            src={profile.avatar_url}
            name={profile.full_name ?? profile.username}
            size="xl"
          />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-lg font-semibold text-ink">
                {profile.full_name ?? profile.username}
              </p>
              <p className="text-sm text-ink/55">
                @{profile.username} · {profile.email}
              </p>
              <Badge tone={roleTone[profile.role]} className="mt-1.5">
                {roleLabel[profile.role]}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
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
                  {pending ? "Téléversement…" : "Changer la photo"}
                </span>
              </label>
              {profile.avatar_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRemove}
                  disabled={removePending}
                >
                  {removePending ? "…" : "Retirer"}
                </Button>
              )}
            </div>
            <p className="text-xs text-ink/45">JPG, PNG ou WebP — 4 Mo max.</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NameForm({ initial }: { initial: string }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateMyProfileAction(fd);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Nom complet</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input name="full_name" defaultValue={initial} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-700">Enregistré ✓</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await changeMyPasswordAction(fd);
      if (!res.ok) setError(res.error);
      else {
        setDone(true);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Changer le mot de passe</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink/55">
              Nouveau mot de passe
            </label>
            <Input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
            <p className="text-xs text-ink/45">Minimum 8 caractères.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && <p className="text-sm text-green-700">Mot de passe modifié ✓</p>}
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "…" : "Mettre à jour"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
