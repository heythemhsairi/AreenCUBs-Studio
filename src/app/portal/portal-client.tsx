"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Download,
  Film,
  Inbox,
  MessageSquare,
  Sparkles,
} from "lucide-react";
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
export type PortalPlan = {
  id: string;
  month: number;
  year: number;
  theme: string | null;
  status: string;
};

export function PortalClient({
  contactName,
  orgName,
  plans,
  items,
  reviews,
  loadError,
}: {
  contactName: string;
  orgName: string | null;
  plans: PortalPlan[];
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
  const currentPlan = plans[0] ?? null;
  const datedItems = items.filter((item) => item.publishDate);
  const deliveredItems = items.filter((item) => item.assetUrl);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <header className="rounded-2xl border border-line bg-surface px-5 py-6 shadow-soft sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Espace client</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">
          {orgName ?? "Espace client"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-content-2">
          Bonjour {contactName}. Voici vos contenus et ce qui attend votre validation.
        </p>
      </header>

      <section aria-label="Vue d'ensemble" className="grid gap-3 sm:grid-cols-3">
        <PortalMetric label="Décisions attendues" value={awaiting.length} detail="contenus à valider" />
        <PortalMetric label="Vidéos en revue" value={reviews.length} detail="montages disponibles" />
        <PortalMetric label="Contenus partagés" value={items.length} detail="dans votre espace" />
      </section>

      {currentPlan && (
        <Card className="overflow-hidden border-brand/30 bg-gradient-to-br from-brand/10 to-surface">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-brand/15 p-2.5 text-brand"><Sparkles size={20} aria-hidden="true" /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Plan éditorial actuel</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">
                  {currentPlan.theme || "Votre programmation éditoriale"}
                </h2>
                <p className="mt-1 text-sm text-content-2">
                  {monthLabel(currentPlan.month)} {currentPlan.year} · {datedItems.length} publication{datedItems.length === 1 ? "" : "s"} visible{datedItems.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <Badge tone="blue">{planStatusLabel(currentPlan.status)}</Badge>
          </CardContent>
        </Card>
      )}

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger bg-danger-weak p-4"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
          <p className="text-sm text-ink">
            Certains contenus n&apos;ont pas pu être chargés. Réessayez dans un instant.
          </p>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <Card className="lg:row-span-2">
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
            <ul className="divide-y divide-line">
              {reviews.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/portal/review/${r.id}`}
                    className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Film size={16} className="shrink-0 text-content-3" aria-hidden="true" />
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
            <ul className="divide-y divide-line">
              {settled.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                    <p className="truncate text-xs text-content-3">
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
      </div>

      <section className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays size={18} className="text-brand" aria-hidden="true" />
              Calendrier de publication
            </CardTitle>
          </CardHeader>
          <CardContent>
            {datedItems.length === 0 ? (
              <EmptyState icon={<CalendarDays />} title="Aucune date partagée" description="Les prochaines publications apparaîtront ici." size="sm" />
            ) : (
              <ol className="space-y-1">
                {datedItems.map((item) => (
                  <li key={item.id} className="flex gap-4 rounded-lg px-2 py-3 hover:bg-surface-2">
                    <time className="w-20 shrink-0 text-xs font-semibold uppercase text-brand" dateTime={item.publishDate ?? undefined}>
                      {formatPortalDate(item.publishDate)}
                    </time>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                      <p className="text-xs text-content-3">{item.platform} · {item.contentType}</p>
                    </div>
                    <Badge tone={badgeTone(item)}>{settledLabel(item)}</Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download size={18} className="text-brand" aria-hidden="true" />
              Livrables disponibles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deliveredItems.length === 0 ? (
              <EmptyState icon={<Download />} title="Aucun livrable final" description="Les fichiers validés seront centralisés ici dès qu'ils seront prêts." size="sm" />
            ) : (
              <ul className="divide-y divide-line">
                {deliveredItems.map((item) => (
                  <li key={item.id}>
                    <a href={item.assetUrl ?? "#"} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-4 py-3 text-sm font-medium text-ink hover:text-brand">
                      <span className="truncate">{item.title}</span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-brand"><Download size={14} aria-hidden="true" /> Ouvrir</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function PortalMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-soft">
      <p className="text-xs font-medium text-content-3">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-content-3">{detail}</p>
    </div>
  );
}

function monthLabel(month: number) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month - 1, 1)));
}

function formatPortalDate(value: string | null) {
  if (!value) return "À définir";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function planStatusLabel(status: string) {
  if (status === "approved") return "Validé";
  if (status === "active") return "En cours";
  if (status === "draft") return "En préparation";
  return status;
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
    <div className="rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-ink">{item.title}</h3>
          <p className="text-xs text-content-3">
            {item.platform} · {item.contentType}
            {item.publishDate ? ` · prévu le ${item.publishDate}` : ""}
          </p>
        </div>
        <Badge tone="amber">En attente de votre validation</Badge>
      </div>

      {item.caption && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-content-2">{item.caption}</p>
      )}

      <div className="mt-4 space-y-2">
        <label htmlFor={feedbackId} className="block text-xs font-medium text-content-2">
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
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
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
