"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  setFeaturedEmployeeAction,
  clearFeaturedEmployeeAction,
} from "../actions";

type Member = {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
};

type FeaturedRecord = {
  id: string;
  month: string;
  reason: string | null;
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

function formatMonth(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

export function FeaturedEmployeeClient({
  currentMonth,
  members,
  featured,
}: {
  currentMonth: string;
  members: Member[];
  featured: FeaturedRecord[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [clearPending, startClear] = useTransition();

  const currentRecord = featured.find((f) => f.month === currentMonth) ?? null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await setFeaturedEmployeeAction(fd);
      if (!res.ok) setError(res.error);
      else setSaved(true);
    });
  }

  function onClear(month: string) {
    if (!confirm("Retirer l'employé du mois pour cette période ?")) return;
    const fd = new FormData();
    fd.set("month", month);
    startClear(async () => {
      await clearFeaturedEmployeeAction(fd);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employé du mois"
        subtitle={
          <Link href="/dashboard/team" className="hover:underline">
            ← Équipe
          </Link>
        }
      />

      {currentRecord && (
        <Card className="featured-card relative overflow-hidden border-accent/40 dark:border-accent/30">
          <CardContent className="relative p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-dark ring-1 ring-accent/40 dark:bg-accent/30 dark:text-[#ffd9a3] dark:ring-accent/60">
                ⭐ Employé du mois · {formatMonth(currentRecord.month)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onClear(currentRecord.month)}
                disabled={clearPending}
                className="border-accent/40 text-accent-dark dark:border-accent/50 dark:bg-accent/10 dark:text-[#ffd9a3]"
              >
                {clearPending ? "…" : "Retirer"}
              </Button>
            </div>

            <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-stretch">
              {/* Avatar with triple-layer halo + crown */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 -m-3 animate-pulse rounded-full bg-gradient-to-br from-accent via-accent-dark to-brand opacity-55 blur-xl dark:opacity-75" />
                <div className="absolute inset-0 -m-1 rounded-full bg-gradient-to-br from-accent to-brand p-[3px]">
                  <div className="h-full w-full rounded-full bg-cream dark:bg-[#13151c]" />
                </div>
                <Avatar
                  src={currentRecord.avatar_url}
                  name={currentRecord.full_name ?? currentRecord.username}
                  size="xl"
                  className="relative ring-2 ring-accent ring-offset-2 ring-offset-cream dark:ring-offset-[#13151c]"
                />
                <span
                  className="absolute -top-4 left-1/2 -translate-x-1/2 -rotate-12 text-3xl drop-shadow-md"
                  aria-hidden
                >
                  👑
                </span>
              </div>

              <div className="flex flex-col justify-center text-center sm:text-left">
                <h2 className="text-3xl font-semibold tracking-tight md:text-[34px]">
                  <span className="bg-gradient-to-r from-accent-dark via-accent to-brand bg-clip-text text-transparent dark:from-[#ffb84d] dark:via-[#ffd9a3] dark:to-[#a0d2eb]">
                    {currentRecord.full_name ?? currentRecord.username}
                  </span>
                </h2>
                {currentRecord.reason && (
                  <p className="mt-2 max-w-xl text-sm italic leading-relaxed text-ink/75 dark:text-cream/90">
                    « {currentRecord.reason} »
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>
            {currentRecord
              ? "Modifier l'employé du mois"
              : "Désigner l'employé du mois"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink/80">Mois</label>
              <Input
                name="month"
                type="month"
                defaultValue={currentMonth}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink/80">Membre</label>
              <Select
                name="user_id"
                defaultValue={currentRecord?.user_id ?? ""}
                required
              >
                <option value="">— Choisir —</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? `@${m.username}`}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink/80">
                Raison / Note
              </label>
              <Textarea
                name="reason"
                rows={3}
                defaultValue={currentRecord?.reason ?? ""}
                placeholder="Pourquoi cette personne ce mois-ci ?"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && (
              <p className="text-sm text-green-600">Enregistré ✓</p>
            )}

            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {featured.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Historique</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-ink/5">
              {featured
                .filter((f) => f.month !== currentMonth)
                .map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={f.avatar_url}
                        name={f.full_name ?? f.username}
                      />
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {f.full_name ?? f.username}
                        </p>
                        <p className="text-xs text-ink/50">
                          {formatMonth(f.month)}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onClear(f.month)}
                      disabled={clearPending}
                    >
                      Retirer
                    </Button>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
