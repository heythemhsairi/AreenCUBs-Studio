"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { useI18n } from "@/lib/i18n/provider";
import { useNow } from "@/lib/time/now";
import { APP_TIME_ZONE } from "@/lib/format";
import type { UserRole } from "@/lib/utils";

/**
 * The overview's page identity.
 *
 * ── Why it moved out of OverviewClient ───────────────────────────────────────
 *
 * `/dashboard` used to open with three panels before it: a stale-quotes alert
 * banner, the quick-action row and the today-summary card. The greeting — the
 * only thing on the page that says whose workspace this is and what it is —
 * came fourth, roughly 400px down. Every other route in the product opens with
 * a PageHeader; the one route a person sees first did not.
 *
 * Exceptions are important, but they are not orientation. You cannot judge
 * "1 devis attend une réponse depuis plus de 7 jours" before you know whether
 * you are looking at the whole agency or at your own desk — which is exactly
 * what the eyebrow (ESPACE ADMIN / ESPACE ÉQUIPE) tells you.
 *
 * ── Why it is now a PageHeader ───────────────────────────────────────────────
 *
 * It was a bespoke block with a 30/36px `<h1>`, while every other route used
 * PageHeader at 22/26px. Same role, two treatments, and the biggest heading in
 * the product sat on the page with the least specific content. Reusing
 * PageHeader gives the overview the same eyebrow / title / description
 * structure and the same rule beneath it as the other twenty-four routes.
 */
export function DashboardGreeting({
  fullName,
  role,
  action,
}: {
  fullName: string;
  role: UserRole;
  /** Primary actions for the role, rendered beside the title. */
  action?: React.ReactNode;
}) {
  const { t } = useI18n();

  // Africa/Tunis hour, not the runtime's. Reading getHours() from a
  // render-time `new Date()` gave the UTC hour on the server and the Tunis
  // hour in the browser, so the greeting text differed and hydration failed
  // (#418). The greeting itself is unchanged — it is still the local hour.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: APP_TIME_ZONE,
    }).format(useNow()),
  );

  const time =
    hour < 5
      ? t.greeting.goodNight
      : hour < 12
        ? t.greeting.goodMorning
        : hour < 18
          ? t.greeting.goodAfternoon
          : t.greeting.goodEvening;

  const space =
    role === "admin"
      ? t.greeting.spaceAdmin
      : role === "worker"
        ? t.greeting.spaceTeam
        : t.greeting.spaceFreelance;

  const description =
    role === "admin"
      ? t.dashboard.admin.title
      : role === "worker"
        ? t.dashboard.worker.title
        : t.dashboard.freelancer.title;

  return (
    <PageHeader
      subtitle={space}
      title={`${time}, ${fullName.split(" ")[0]} 👋`}
      description={description}
      action={action}
    />
  );
}
