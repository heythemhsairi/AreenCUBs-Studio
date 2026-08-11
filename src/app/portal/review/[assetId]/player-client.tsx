"use client";

import { useRef, useState, useTransition } from "react";
import { Clock, Film, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addReviewCommentAction } from "../../actions";

export type PortalReviewComment = {
  id: string;
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

const STATUS_LABEL: Record<string, string> = {
  in_review: "En attente de votre retour",
  changes_requested: "Vos retours sont pris en compte",
  approved: "Validé",
};

/**
 * The player and the conversation.
 *
 * The timecode is captured from the video element at the moment the person
 * chooses to pin their comment — not typed by hand — so a remark like "the
 * logo appears too early" arrives attached to the exact second it refers to.
 * Comments always target the current version; the superseded-version and
 * membership rules live in `portal_add_review_comment`, not here.
 */
export function PortalPlayerClient({
  assetId,
  title,
  status,
  versionId,
  versionNumber,
  mediaUrl,
  comments,
}: {
  assetId: string;
  title: string;
  status: string;
  versionId: string | null;
  versionNumber: number | null;
  mediaUrl: string | null;
  comments: PortalReviewComment[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pinCurrentTime() {
    const t = videoRef.current?.currentTime;
    setPinned(t !== undefined && Number.isFinite(t) ? Math.round(t * 100) / 100 : 0);
  }

  function seekTo(seconds: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.focus();
    }
  }

  function submit() {
    if (!versionId) return;
    setError(null);
    const fd = new FormData();
    fd.set("asset_id", assetId);
    fd.set("version_id", versionId);
    fd.set("body", body);
    if (pinned !== null) fd.set("timecode_seconds", String(pinned));
    startTransition(async () => {
      const result = await addReviewCommentAction(fd);
      if (!result.ok) setError(result.error);
      else {
        setBody("");
        setPinned(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status === "approved" ? "green" : "amber"}>
            {STATUS_LABEL[status] ?? status}
          </Badge>
          {versionNumber !== null && (
            <span className="text-xs text-ink/60">version {versionNumber}</span>
          )}
        </div>
      </header>

      <Card>
        <CardContent className="pt-6">
          {mediaUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- review cuts
            // are work-in-progress uploads without caption tracks.
            <video ref={videoRef} src={mediaUrl} controls className="w-full rounded-lg bg-black" />
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Film className="h-8 w-8 text-ink/40" aria-hidden="true" />
              <p className="text-sm font-medium text-ink">Aperçu indisponible</p>
              <p className="text-sm text-ink/60">
                {versionId
                  ? "La vidéo n'est pas encore accessible. Réessayez dans un instant."
                  : "Aucune version n'a encore été partagée."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vos retours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-ink/60">
              Aucun commentaire pour le moment. Dites-nous ce que vous en pensez.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg border border-[var(--c-border)] p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone={c.side === "client" ? "amber" : "cyan"}>
                      {c.side === "client" ? "Vous" : "Areen CUBs"}
                    </Badge>
                    {c.timecode !== null && (
                      <button
                        type="button"
                        onClick={() => seekTo(c.timecode as number)}
                        className="inline-flex items-center gap-1 rounded text-ink/70 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]"
                      >
                        <Clock size={12} aria-hidden="true" />
                        {formatTimecode(c.timecode)}
                      </button>
                    )}
                    {c.resolved && <Badge tone="green">Traité</Badge>}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink/90">{c.body}</p>
                </li>
              ))}
            </ul>
          )}

          {versionId && (
            <div className="space-y-2 border-t border-[var(--c-border)] pt-4">
              <label htmlFor="portal-review-comment" className="block text-xs font-medium text-ink/70">
                Ajouter un commentaire
              </label>
              <Textarea
                id="portal-review-comment"
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                placeholder="Votre retour sur cette version…"
              />
              <div className="flex flex-wrap items-center gap-2">
                {mediaUrl && (
                  <Button type="button" variant="outline" size="sm" onClick={pinCurrentTime}>
                    <Clock size={14} aria-hidden="true" />
                    {pinned !== null
                      ? `Épinglé à ${formatTimecode(pinned)}`
                      : "Épingler au moment actuel"}
                  </Button>
                )}
                {pinned !== null && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPinned(null)}>
                    Retirer le repère
                  </Button>
                )}
                <Button type="button" onClick={submit} disabled={pending || body.trim().length === 0}>
                  <MessageSquare size={14} aria-hidden="true" />
                  Envoyer
                </Button>
              </div>
              {error && (
                <p role="alert" className="text-sm text-rose-400">
                  {error}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
