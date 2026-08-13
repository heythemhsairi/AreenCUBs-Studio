"use client";

import { BrandLogo } from "@/components/brand-logo";
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
  const { t, locale } = useI18n();
  const now = useNow();

  // Africa/Tunis hour, not the runtime's. Reading getHours() from a
  // render-time `new Date()` gave the UTC hour on the server and the Tunis
  // hour in the browser, so the greeting text differed and hydration failed
  // (#418). The greeting itself is unchanged — it is still the local hour.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hour12: false,
      timeZone: APP_TIME_ZONE,
    }).format(now),
  );

  const dateLabel = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(now);

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

  const welcome = locale === "en"
    ? "Good to have you back. Here’s what matters today."
    : "Heureux de vous retrouver. Voici l’essentiel pour aujourd’hui.";

  return (
    <section className="dashboard-welcome relative isolate overflow-hidden rounded-2xl border border-brand-500/20 bg-surface px-5 py-6 shadow-ac-sm sm:px-7 sm:py-7">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-brand-900" />
      <div className="relative flex items-center justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent2">
              {space}
            </span>
            <span className="capitalize text-xs font-medium text-content-3">{dateLabel}</span>
          </div>
          <h1 className="mt-4 text-[28px] font-semibold leading-tight tracking-[-0.025em] text-content sm:text-[34px]">
            {time}, {fullName.split(" ")[0]} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-content-2 sm:text-[15px]">{welcome}</p>
          <p className="mt-1 text-xs text-content-3">{description}</p>
        </div>

        <div className="brand-mark-motion hidden h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-ac-md sm:flex" aria-hidden="true">
          <BrandLogo kind="icon" width={44} className="text-white" />
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}
