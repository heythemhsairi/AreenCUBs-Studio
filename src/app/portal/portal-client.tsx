"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Film, Inbox, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { setContentApprovalAction } from "./actions";

export type PortalItem = {
  id: string;
  title: string;
  contentType: string;
  platform: string;
  caption: string | null;
  publishDate: string | null;
  status: string;
  approvalStatus: string | null;
  assetUrl: string | null;
};

/**
 * The portal, as the client sees it.
 *
 * Two groups: what needs a decision, and what has already been settled. Every
 * field shown comes from `portal_content_items`, which projects only
 * client-facing columns — there is no worker name, no internal deadline, no
 * priority, no brief and no cost anywhere on this page, because none of those
 * reach the browser in the first place.
 */
export type PortalReview = { id: string; title: string; status: string };

export function PortalClient({
  contactName,
  orgName,
  items,
  reviews,
  loadError,
}: {
  contactName: string;
  orgName: string | null;
  items: PortalItem[];
  reviews: PortalReview[];
  loadError: string | null;
}) {
  // Split on the client's own DECISION, not on the internal workflow status.
  //
  // portal_set_approval deliberately does not advance `status` — moving an item
  // through production belongs to the agency — so an approved item stays in
  // 'client_review' until the team acts. Grouping by status therefore left
  // every item the client had already answered sitting in the pending list
  // forever, asking again. The e2e approval test caught it.
  const isPending = (i: PortalItem) =>
    i.status === "client_review" && (i.approvalStatus ?? "pending") === "pending";

  const awaiting = items.filter(isPending);
  const settled = items.filter((i) => !isPending(i));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">
          {orgName ?? "Espace client"}
        </h1>
        <p className="text-sm text-ink/70">
          Bonjour {contactName}. Voici vos contenus et ce qui attend votre validation.
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-rose-500/35 bg-rose-500/10 p-4"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-400" aria-hidden="true" />
          <p className="text-sm text-ink">
            Certains contenus n&apos;ont pas pu être chargés. Réessayez dans un instant.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>À valider</CardTitle>
        </CardHeader>
        <CardContent>
          {awaiting.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="Rien à valider"
              description="Vous serez notifié dès qu'un contenu attend votre retour."
              size="sm"
            />
          ) : (
            <ul className="space-y-4">
              {awaiting.map((item) => (
                <li key={item.id}>
                  <ReviewCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Vidéos à visionner</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-[var(--c-border)]">
              {reviews.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/portal/review/${r.id}`}
                    className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-[var(--c-surface-2)]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Film size={16} className="shrink-0 text-ink/60" aria-hidden="true" />
                      <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                    </div>
                    <Badge tone={r.status === "approved" ? "green" : "amber"}>
                      {r.status === "approved"
                        ? "Validé"
                        : r.status === "changes_requested"
                          ? "Retours envoyés"
                          : "À visionner"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Vos contenus</CardTitle>
        </CardHeader>
        <CardContent>
          {settled.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 />}
              title="Aucun contenu pour le moment"
              description="Vos publications apparaîtront ici une fois préparées."
              size="sm"
            />
          ) : (
            <ul className="divide-y divide-[var(--c-border)]">
              {settled.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                    <p className="truncate text-xs text-ink/60">
                      {item.platform} · {item.contentType}
                      {item.publishDate ? ` · ${item.publishDate}` : ""}
                    </p>
                  </div>
                  <Badge tone={badgeTone(item)}>{settledLabel(item)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * What to call an item the client has finished with.
 *
 * Their own decision takes precedence over the production status: once they
 * have answered, "Validé par vous" is the honest label even though the item is
 * still sitting in 'client_review' waiting for the team.
 */
function settledLabel(item: PortalItem) {
  if (item.approvalStatus === "revision_requested") return "Modification demandée";
  if (item.status === "client_review" && item.approvalStatus === "approved") {
    return "Validé par vous";
  }
  switch (item.status) {
    case "approved":
      return "Validé";
    case "scheduled":
      return "Programmé";
    case "published":
      return "Publié";
    default:
      return item.status;
  }
}

function badgeTone(item: PortalItem) {
  if (item.approvalStatus === "revision_requested") return "amber" as const;
  if (item.status === "published") return "green" as const;
  return "blue" as const;
}

/** One item awaiting a decision, with the two actions a client may take. */
function ReviewCard({ item }: { item: PortalItem }) {
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(decision: "approved" | "revision_requested") {
    setError(null);
    const data = new FormData();
    data.set("item_id", item.id);
    data.set("decision", decision);
    data.set("feedback", feedback);
    startTransition(async () => {
      const result = await setContentApprovalAction(data);
      if (!result.ok) setError(result.error);
      else setFeedback("");
    });
  }

  const feedbackId = `feedback-${item.id}`;
  const errorId = `error-${item.id}`;

  return (
    <div className="rounded-lg border border-[var(--c-border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-ink">{item.title}</h3>
          <p className="text-xs text-ink/60">
            {item.platform} · {item.contentType}
            {item.publishDate ? ` · prévu le ${item.publishDate}` : ""}
          </p>
        </div>
        <Badge tone="amber">En attente de votre validation</Badge>
      </div>

      {item.caption && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-ink/80">{item.caption}</p>
      )}

      <div className="mt-4 space-y-2">
        <label htmlFor={feedbackId} className="block text-xs font-medium text-ink/70">
          Commentaire (obligatoire pour demander une modification)
        </label>
        <Textarea
          id={feedbackId}
          name="feedback"
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          maxLength={2000}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          placeholder="Ce qui doit être ajusté…"
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-rose-400">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => submit("approved")} disabled={pending}>
          <CheckCircle2 size={16} aria-hidden="true" />
          Valider
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => submit("revision_requested")}
          disabled={pending}
        >
          <MessageSquare size={16} aria-hidden="true" />
          Demander une modification
        </Button>
      </div>
    </div>
  );
}
