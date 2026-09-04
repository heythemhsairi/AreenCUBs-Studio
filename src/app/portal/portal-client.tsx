"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  Film,
  Inbox,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { setContentApprovalAction } from "./actions";
import { PortalSidebar, PortalMobileNav, type PortalSection } from "@/components/portal/portal-nav";
import { TaskWorkspace } from "@/components/portal/task-workspace";
import { MiniCalendar } from "@/components/portal/mini-calendar";
import { StatusDonut, type DonutSlice } from "@/components/portal/portal-charts";
import { groupPortalTasks, isClosedStatus, type PortalTaskLike } from "@/lib/portal/tasks";
import type { PortalCalendarEntry } from "@/lib/portal/calendar";

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
 * Every field shown comes from the `portal_*` views, which project only
 * client-facing columns — there is no worker name, no internal deadline, no
 * priority, no brief and no cost anywhere on this page, because none of those
 * reach the browser in the first place. Navigation between sections is
 * client-side state, not routing: there is exactly one server-fetched page,
 * so every "section" here is a real, populated view rather than a route that
 * could be left unfinished.
 */
export type PortalReview = { id: string; title: string; status: string };
export type PortalTask = PortalTaskLike;
export type PortalPlan = {
  id: string;
  month: number;
  year: number;
  theme: string | null;
  status: string;
};

function formatPortalDate(value: string | null) {
  if (!value) return "À définir";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

/** The client's own decision takes precedence over the internal workflow status. */
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

export function PortalClient({
  contactName,
  orgName,
  plans,
  items,
  reviews,
  tasks,
  loadError,
  nowIso,
}: {
  contactName: string;
  orgName: string | null;
  plans: PortalPlan[];
  items: PortalItem[];
  reviews: PortalReview[];
  tasks: PortalTask[];
  loadError: string | null;
  nowIso: string;
}) {
  const [active, setActive] = useState<PortalSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();

  function onSignOut() {
    startSignOut(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

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
  const datedItems = items.filter((item) => item.publishDate);
  const deliveredItems = items.filter((item) => item.assetUrl);
  const pendingReviews = reviews.filter((r) => r.status !== "approved");
  const currentPlan = plans[0] ?? null;

  const groups = useMemo(() => groupPortalTasks(tasks), [tasks]);
  const spotlightProject = groups.find((g) => g.isActive) ?? null;

  const calendarEntries: PortalCalendarEntry[] = useMemo(
    () => [
      ...datedItems.map((item) => ({
        id: `content-${item.id}`,
        date: item.publishDate as string,
        title: item.title,
        kind: "publication" as const,
      })),
      ...tasks
        .filter((t) => t.deadline && !isClosedStatus(t.status))
        .map((t) => ({
          id: `task-${t.id}`,
          date: t.deadline as string,
          title: t.title,
          kind: "deadline" as const,
        })),
    ],
    [datedItems, tasks],
  );

  const counts = { content: awaiting.length, reviews: pendingReviews.length };

  const navProps = {
    orgName,
    contactName,
    active,
    onSelect: setActive,
    counts,
    onSignOut,
    signingOut,
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      <PortalSidebar {...navProps} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalMobileNav {...navProps} open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
        <main
          tabIndex={0}
          className="flex-1 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent2"
        >
          <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 md:py-9">
            <PortalHeader
              orgName={orgName}
              contactName={contactName}
              awaitingCount={awaiting.length}
              pendingReviewsCount={pendingReviews.length}
              deliverablesCount={deliveredItems.length}
            />

            {loadError && (
              <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger bg-danger-weak p-4">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-sm text-content">
                  Une partie de votre espace n&apos;a pas pu être chargée. Réessayez dans un instant — si le
                  problème persiste, votre interlocuteur chez Areen CUBs peut nous le signaler.
                </p>
              </div>
            )}

            {active === "overview" && (
              <OverviewPanel
                spotlightProject={spotlightProject}
                awaiting={awaiting}
                items={items}
                onGoToTasks={() => setActive("tasks")}
                onGoToContent={() => setActive("content")}
              />
            )}

            {active === "tasks" && (
              <section aria-labelledby="portal-section-title">
                <h2 id="portal-section-title" className="mb-4 text-base font-semibold text-content">Tâches</h2>
                <TaskWorkspace tasks={tasks} nowIso={nowIso} />
              </section>
            )}

            {active === "calendar" && (
              <section aria-labelledby="portal-section-title">
                <h2 id="portal-section-title" className="mb-4 text-base font-semibold text-content">Calendrier</h2>
                <MiniCalendar entries={calendarEntries} nowIso={nowIso} />
              </section>
            )}

            {active === "content" && (
              <section aria-labelledby="portal-section-title">
                <h2 id="portal-section-title" className="mb-4 text-base font-semibold text-content">Contenus</h2>
                <ContentPanel awaiting={awaiting} settled={settled} currentPlan={currentPlan} />
              </section>
            )}

            {active === "reviews" && (
              <section aria-labelledby="portal-section-title">
                <h2 id="portal-section-title" className="mb-4 text-base font-semibold text-content">Revues vidéo</h2>
                <ReviewsPanel reviews={reviews} />
              </section>
            )}

            {active === "deliverables" && (
              <section aria-labelledby="portal-section-title">
                <h2 id="portal-section-title" className="mb-4 text-base font-semibold text-content">Livrables</h2>
                <DeliverablesPanel items={deliveredItems} />
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCell({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div className="min-w-[130px] flex-1 px-4 py-2.5">
      <dt className="text-[11px] text-content-3">{label}</dt>
      <dd className={cn("text-lg font-semibold tabular-nums", emphasize ? "text-brand" : "text-content")}>{value}</dd>
    </div>
  );
}

function PortalHeader({
  orgName,
  contactName,
  awaitingCount,
  pendingReviewsCount,
  deliverablesCount,
}: {
  orgName: string | null;
  contactName: string;
  awaitingCount: number;
  pendingReviewsCount: number;
  deliverablesCount: number;
}) {
  return (
    <header className="space-y-4 border-b border-line pb-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Espace client</p>
        <h1 className="mt-1 text-xl font-semibold text-content sm:text-2xl">{orgName ?? "Espace client"}</h1>
        <p className="mt-1 text-sm text-content-2">
          Bonjour {contactName}. Voici vos contenus et ce qui attend votre validation.
        </p>
      </div>
      <dl className="flex flex-wrap divide-x divide-line overflow-hidden rounded-lg border border-line">
        <StatCell label="Décisions attendues" value={awaitingCount} emphasize={awaitingCount > 0} />
        <StatCell label="Vidéos à visionner" value={pendingReviewsCount} />
        <StatCell label="Livrables disponibles" value={deliverablesCount} />
      </dl>
    </header>
  );
}

function OverviewPanel({
  spotlightProject,
  awaiting,
  items,
  onGoToTasks,
  onGoToContent,
}: {
  spotlightProject: ReturnType<typeof groupPortalTasks>[number] | null;
  awaiting: PortalItem[];
  items: PortalItem[];
  onGoToTasks: () => void;
  onGoToContent: () => void;
}) {
  const spotlightTasks = spotlightProject
    ? [...spotlightProject.parents, ...Object.values(spotlightProject.subtasksByParent).flat()]
    : [];
  const countStatus = (status: string) => spotlightTasks.filter((t) => t.status === status).length;
  const taskDonutData: DonutSlice[] = [
    { label: "À faire", value: countStatus("todo"), tone: "warning" },
    { label: "En cours", value: countStatus("in_progress") + countStatus("review"), tone: "info" },
    { label: "Terminé", value: countStatus("done"), tone: "success" },
    { label: "Annulé", value: countStatus("cancelled"), tone: "neutral" },
  ];

  const publishedCount = items.filter((i) => i.status === "published").length;
  const otherSettledCount = Math.max(items.length - awaiting.length - publishedCount, 0);
  const contentDonutData: DonutSlice[] = [
    { label: "À valider", value: awaiting.length, tone: "warning" },
    { label: "Publié", value: publishedCount, tone: "success" },
    { label: "Autres validés", value: otherSettledCount, tone: "info" },
  ];

  return (
    <div className="space-y-6">
      {spotlightProject && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-brand">Projet actif</p>
              <h2 className="mt-0.5 text-base font-semibold text-content">{spotlightProject.projectName}</h2>
              <p className="mt-1 text-sm text-content-2">
                {spotlightProject.doneCount}/{spotlightProject.totalCount} tâches terminées
                {spotlightProject.nextDeadline
                  ? ` · prochaine échéance le ${formatPortalDate(spotlightProject.nextDeadline)}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToTasks}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-brand transition-colors duration-2 ease-ac hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2"
            >
              Voir les tâches
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatusDonut
          title="Répartition des tâches"
          subtitle={spotlightProject?.projectName}
          centerLabel="tâches"
          emptyLabel="Aucune tâche pour le moment."
          data={taskDonutData}
        />
        <StatusDonut
          title="Répartition des contenus"
          centerLabel="contenus"
          emptyLabel="Aucun contenu pour le moment."
          data={contentDonutData}
        />
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-content">À valider</h2>
          {awaiting.length > 0 && (
            <button
              type="button"
              onClick={onGoToContent}
              className="rounded-md px-1.5 py-1 text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2"
            >
              Tout voir
            </button>
          )}
        </div>
        {awaiting.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="Rien à valider"
            description="Vous serez informé dès qu'un contenu attend votre retour."
            size="sm"
          />
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {awaiting.slice(0, 3).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-content">{item.title}</p>
                  <p className="text-xs text-content-3">
                    {item.platform} · {item.contentType}
                  </p>
                </div>
                <Badge tone="amber">À valider</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function monthLabel(month: number) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, month - 1, 1)),
  );
}

function planStatusLabel(status: string) {
  if (status === "approved") return "validé";
  if (status === "active") return "en cours";
  if (status === "draft") return "en préparation";
  return status;
}

function ContentPanel({
  awaiting,
  settled,
  currentPlan,
}: {
  awaiting: PortalItem[];
  settled: PortalItem[];
  currentPlan: PortalPlan | null;
}) {
  return (
    <div className="space-y-8">
      {currentPlan && (
        <p className="text-xs text-content-3">
          Plan éditorial :{" "}
          <span className="font-medium text-content-2">
            {currentPlan.theme || `${monthLabel(currentPlan.month)} ${currentPlan.year}`}
          </span>{" "}
          · {planStatusLabel(currentPlan.status)}
        </p>
      )}

      <section>
        <h3 className="text-sm font-semibold text-content">À valider</h3>
        {awaiting.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="Rien à valider"
            description="Vous serez informé dès qu'un contenu attend votre retour."
            size="sm"
          />
        ) : (
          <ul className="mt-3 space-y-4">
            {awaiting.map((item) => (
              <li key={item.id}>
                <ApprovalCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-content">Déjà traités</h3>
        {settled.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 />}
            title="Aucun contenu pour le moment"
            description="Vos publications apparaîtront ici une fois préparées."
            size="sm"
          />
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {settled.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-content">{item.title}</p>
                  <p className="text-xs text-content-3">
                    {item.platform} · {item.contentType}
                    {item.publishDate ? ` · ${formatPortalDate(item.publishDate)}` : ""}
                  </p>
                </div>
                <Badge tone={badgeTone(item)}>{settledLabel(item)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReviewsPanel({ reviews }: { reviews: PortalReview[] }) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<Film />}
        title="Aucune vidéo à visionner"
        description="Les montages partagés par l'équipe apparaîtront ici."
      />
    );
  }
  return (
    <ul className="divide-y divide-line">
      {reviews.map((r) => (
        <li key={r.id}>
          <Link
            href={`/portal/review/${r.id}`}
            className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 transition-colors duration-2 ease-ac hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 focus-visible:ring-inset"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Film size={16} className="shrink-0 text-content-3" aria-hidden="true" />
              <p className="text-sm font-medium text-content">{r.title}</p>
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
  );
}

function DeliverablesPanel({ items }: { items: PortalItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Download />}
        title="Aucun livrable final"
        description="Les fichiers validés seront centralisés ici dès qu'ils seront prêts."
      />
    );
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.assetUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3 text-sm font-medium text-content transition-colors duration-2 ease-ac hover:bg-surface-2 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2 focus-visible:ring-inset"
          >
            <span className="min-w-0 flex-1">{item.title}</span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-brand">
              <Download size={14} aria-hidden="true" /> Ouvrir
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** One item awaiting a decision, with the two actions a client may take. */
function ApprovalCard({ item }: { item: PortalItem }) {
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
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-content">{item.title}</h4>
          <p className="text-xs text-content-3">
            {item.platform} · {item.contentType}
            {item.publishDate ? ` · prévu le ${formatPortalDate(item.publishDate)}` : ""}
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
    </Card>
  );
}
