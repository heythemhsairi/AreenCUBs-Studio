"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Clapperboard, Plus, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  appendReviewFileMetadata,
  uploadReviewVideoToTicket,
} from "@/lib/review-upload-client";
import {
  abandonReviewUploadAction,
  finalizeReviewUploadAction,
  prepareReviewAssetUploadAction,
} from "./upload-actions";

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
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choisissez la vidéo à envoyer.");
      return;
    }

    const prepareData = new FormData();
    prepareData.set("title", String(formData.get("title") ?? ""));
    prepareData.set("client_id", String(formData.get("client_id") ?? ""));
    appendReviewFileMetadata(prepareData, file);

    setError(null);
    startTransition(async () => {
      let cleanupData: FormData | null = null;
      try {
        setUploadStatus("Préparation…");
        const prepared = await prepareReviewAssetUploadAction(prepareData);
        if (!prepared.ok) {
          setError(prepared.error);
          return;
        }
        cleanupData = new FormData();
        cleanupData.set("asset_id", prepared.ticket.assetId);
        cleanupData.set("storage_path", prepared.ticket.storagePath);
        cleanupData.set("version_number", String(prepared.ticket.versionNumber));

        setUploadStatus("Envoi de la vidéo…");
        const uploadError = await uploadReviewVideoToTicket(prepared.ticket, file);
        if (uploadError) {
          await abandonReviewUploadAction(cleanupData);
          setError(uploadError);
          return;
        }

        setUploadStatus("Finalisation…");
        const finalizeData = new FormData();
        finalizeData.set("asset_id", prepared.ticket.assetId);
        finalizeData.set("storage_path", prepared.ticket.storagePath);
        finalizeData.set("version_number", String(prepared.ticket.versionNumber));
        appendReviewFileMetadata(finalizeData, file);
        const finalized = await finalizeReviewUploadAction(finalizeData);
        if (!finalized.ok) {
          setError(finalized.error);
          return;
        }
        router.push(`/dashboard/review/${finalized.id}`);
      } catch {
        if (cleanupData) {
          await abandonReviewUploadAction(cleanupData).catch(() => undefined);
        }
        setError("Le téléversement a été interrompu. Réessayez.");
      } finally {
        setUploadStatus(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Révision vidéo"
        description="Montages partagés avec les clients pour validation, version par version."
        action={canCreate && !showForm ? (
          <Button type="button" onClick={() => setShowForm(true)}>
            <Plus size={16} aria-hidden="true" />
            Nouveau montage
          </Button>
        ) : undefined}
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
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>Nouveau montage</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={submit} className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1">
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
                  <div className="space-y-1 lg:col-span-2">
                    <label htmlFor="review-file" className="text-xs font-medium text-content-2">
                      Vidéo source
                    </label>
                    <Input
                      id="review-file"
                      name="file"
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                      required
                    />
                    <p className="text-xs text-content-3">MP4, WebM, MOV ou MKV · 200 Mo maximum</p>
                  </div>
                  <div className="flex gap-2 lg:col-span-2">
                    <Button type="submit" disabled={pending}>
                      <Upload size={16} aria-hidden="true" />
                      {pending ? uploadStatus ?? "Téléversement…" : "Créer et téléverser"}
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
            <ul className="divide-y divide-line">
              {assets.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/review/${a.id}`}
                    className="flex flex-col gap-1 py-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
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
