"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertCircle, Clapperboard, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { createReviewAssetAction } from "./actions";

export type ReviewAssetRow = {
  id: string;
  title: string;
  status: string;
  clientName: string;
  latestVersion: number;
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  in_review: "En revue",
  changes_requested: "Modifications demandées",
  approved: "Approuvé",
  archived: "Archivé",
};

export const REVIEW_STATUS_TONE: Record<string, Tone> = {
  in_review: "blue",
  changes_requested: "amber",
  approved: "green",
  archived: "slate",
};

export function ReviewListClient({
  assets,
  clients,
  canCreate,
  loadError,
}: {
  assets: ReviewAssetRow[];
  clients: { id: string; name: string }[];
  canCreate: boolean;
  loadError: string | null;
}) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createReviewAssetAction(formData);
      if (!result.ok) setError(result.error);
      else setShowForm(false);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Révision vidéo"
        description="Montages partagés avec les clients pour validation, version par version."
      />

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger bg-danger-weak p-4"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
          <p className="text-sm text-ink">Certaines données n&apos;ont pas pu être chargées.</p>
        </div>
      )}

      {canCreate && (
        <div>
          {!showForm ? (
            <Button type="button" onClick={() => setShowForm(true)}>
              <Plus size={16} aria-hidden="true" />
              Nouveau montage
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Nouveau montage</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1">
                    <label htmlFor="review-title" className="text-xs font-medium text-content-2">
                      Titre
                    </label>
                    <Input id="review-title" name="title" required maxLength={200} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="review-client" className="text-xs font-medium text-content-2">
                      Client
                    </label>
                    <Select id="review-client" name="client_id" required>
                      <option value="">Choisir…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending}>
                      Créer
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                      Annuler
                    </Button>
                  </div>
                </form>
                {error && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    {error}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Montages</CardTitle>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <EmptyState
              icon={<Clapperboard />}
              title="Aucun montage en revue"
              description="Créez un montage puis téléversez une première version."
              size="sm"
            />
          ) : (
            <ul className="divide-y divide-[var(--c-border)]">
              {assets.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/review/${a.id}`}
                    className="flex flex-col gap-1 py-3 transition-colors hover:bg-[var(--c-surface-2)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{a.title}</p>
                      <p className="truncate text-xs text-content-3">
                        {a.clientName}
                        {a.latestVersion > 0 ? ` · v${a.latestVersion}` : " · aucune version"}
                      </p>
                    </div>
                    <Badge tone={REVIEW_STATUS_TONE[a.status] ?? "slate"}>
                      {REVIEW_STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
