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
        <Card className="overflow-hidden border-accent/40 bg-gradient-to-br from-accent/15 via-cream to-cream">
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-dark">
              ⭐ {formatMonth(currentRecord.month)}
            </p>
            <div className="mt-4 flex items-center gap-5">
              <Avatar
                src={currentRecord.avatar_url}
                name={currentRecord.full_name ?? currentRecord.username}
                size="xl"
                className="ring-2 ring-accent"
              />
              <div>
                <p className="text-2xl font-semibold text-ink">
                  {currentRecord.full_name ?? currentRecord.username}
                </p>
                {currentRecord.reason && (
                  <p className="mt-1 max-w-xl text-sm text-ink/70">
                    {currentRecord.reason}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onClear(currentRecord.month)}
                disabled={clearPending}
              >
                {clearPending ? "…" : "Retirer"}
              </Button>
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
