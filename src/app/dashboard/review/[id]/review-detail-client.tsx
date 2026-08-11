"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, Film, MessageSquare, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { REVIEW_STATUS_LABEL, REVIEW_STATUS_TONE } from "../review-list-client";
import {
  addAgencyReviewCommentAction,
  getReviewMediaUrlAction,
  setCommentResolvedAction,
  setReviewStatusAction,
  uploadReviewVersionAction,
} from "../actions";

export type ReviewVersion = {
  id: string;
  number: number;
  mime: string;
  sizeBytes: number;
  createdAt: string;
};

export type ReviewComment = {
  id: string;
  versionId: string;
  side: "agency" | "client";
  body: string;
  timecode: number | null;
  resolved: boolean;
};

function formatTimecode(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export function ReviewDetailClient({
  asset,
  versions,
  comments,
  canMutate,
  canPlayMedia,
}: {
  asset: { id: string; title: string; status: string; clientName: string };
  versions: ReviewVersion[];
  comments: ReviewComment[];
  canMutate: boolean;
  /**
   * Separate from canMutate on purpose: playback is a READ, and a role can be
   * allowed to read the review while still being unable to fetch the file.
   * A commercial holds an RLS policy on review_assets/versions/comments but
   * NO policy on the review-media bucket, so createSignedUrl would fail for
   * them — and getReviewMediaUrlAction is staff-only, so the button did not
   * merely fail, it redirected them off the page entirely.
   */
  canPlayMedia: boolean;
}) {
  const latest = versions[0] ?? null;
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(fd);
      if (!result.ok) setError(result.error ?? "Échec.");
    });
  }

  function loadPreview() {
    if (!latest) return;
    const fd = new FormData();
    fd.set("version_id", latest.id);
    setError(null);
    startTransition(async () => {
      const result = await getReviewMediaUrlAction(fd);
      if (result.ok) setPreviewUrl(result.url);
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/review"
        className="inline-flex items-center gap-1.5 text-sm text-ink/70 transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Révision vidéo
      </Link>

      <PageHeader
        title={asset.title}
        description={`${asset.clientName}${latest ? ` · v${latest.number}` : " · aucune version"}`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={REVIEW_STATUS_TONE[asset.status] ?? "slate"}>
          {REVIEW_STATUS_LABEL[asset.status] ?? asset.status}
        </Badge>
        {canMutate && asset.status !== "approved" && (
          <Button
            type="button"
            size="sm"
            disabled={pending || !latest}
            onClick={() => {
              const fd = new FormData();
              fd.set("asset_id", asset.id);
              fd.set("status", "approved");
              run(setReviewStatusAction, fd);
            }}
          >
            <CheckCircle2 size={14} aria-hidden="true" />
            Marquer approuvé
          </Button>
        )}
        {canMutate && asset.status !== "archived" && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set("asset_id", asset.id);
              fd.set("status", "archived");
              run(setReviewStatusAction, fd);
            }}
          >
            Archiver
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Versions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {versions.length === 0 ? (
                <EmptyState
                  icon={<Film />}
                  title="Aucune version"
                  description="Téléversez le premier montage pour lancer la revue."
                  size="sm"
                />
              ) : (
                <>
                  {previewUrl && canPlayMedia ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption -- review
                    // cuts are work-in-progress uploads without caption tracks.
                    <video src={previewUrl} controls className="w-full rounded-lg bg-black" />
                  ) : canPlayMedia ? (
                    <Button type="button" variant="outline" onClick={loadPreview} disabled={pending}>
                      <Film size={16} aria-hidden="true" />
                      Prévisualiser v{latest?.number}
                    </Button>
                  ) : (
                    <p className="text-xs text-ink/60">
                      Lecture réservée à l&apos;équipe de production.
                    </p>
                  )}
                  <ul className="divide-y divide-[var(--c-border)]">
                    {versions.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                        <p className="text-sm text-ink">
                          v{v.number}
                          {v.id === latest?.id && (
                            <span className="ml-2 text-xs text-ink/60">version actuelle</span>
                          )}
                        </p>
                        <p className="text-xs text-ink/60">
                          {v.mime} · {formatSize(v.sizeBytes)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {canMutate && (
                <form action={(fd) => run(uploadReviewVersionAction, fd)} className="space-y-2">
                  <input type="hidden" name="asset_id" value={asset.id} />
                  <label htmlFor="review-file" className="block text-xs font-medium text-ink/70">
                    Nouvelle version (vidéo, 200 Mo max)
                  </label>
                  <input
                    id="review-file"
                    name="file"
                    type="file"
                    accept="video/*"
                    required
                    className="block w-full text-sm text-ink/80 file:mr-3 file:rounded-md file:border-0 file:bg-[#22D3EE] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#071B2C]"
                  />
                  <Button type="submit" size="sm" disabled={pending}>
                    <Upload size={14} aria-hidden="true" />
                    Téléverser
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Commentaires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.length === 0 ? (
              <EmptyState
                icon={<MessageSquare />}
                title="Aucun commentaire"
                description="Les retours du client et de l'équipe apparaîtront ici."
                size="sm"
              />
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => {
                  const version = versions.find((v) => v.id === c.versionId);
                  return (
                    <li
                      key={c.id}
                      className={`rounded-lg border border-[var(--c-border)] p-3 ${
                        c.resolved ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
                        <Badge tone={c.side === "client" ? "amber" : "cyan"}>
                          {c.side === "client" ? "Client" : "Agence"}
                        </Badge>
                        {version && <span>v{version.number}</span>}
                        {c.timecode !== null && <span>à {formatTimecode(c.timecode)}</span>}
                        {c.resolved && <Badge tone="green">Résolu</Badge>}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-ink/90">{c.body}</p>
                      {canMutate && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-2"
                          disabled={pending}
                          onClick={() => {
                            const fd = new FormData();
                            fd.set("comment_id", c.id);
                            fd.set("asset_id", asset.id);
                            fd.set("resolved", c.resolved ? "false" : "true");
                            run(setCommentResolvedAction, fd);
                          }}
                        >
                          {c.resolved ? "Rouvrir" : "Marquer résolu"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {canMutate && latest && (
              <form action={(fd) => run(addAgencyReviewCommentAction, fd)} className="space-y-2">
                <input type="hidden" name="version_id" value={latest.id} />
                <input type="hidden" name="asset_id" value={asset.id} />
                <label htmlFor="agency-comment" className="block text-xs font-medium text-ink/70">
                  Répondre (v{latest.number})
                </label>
                <Textarea id="agency-comment" name="body" rows={2} required maxLength={2000} />
                <Button type="submit" size="sm" disabled={pending}>
                  Envoyer
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
