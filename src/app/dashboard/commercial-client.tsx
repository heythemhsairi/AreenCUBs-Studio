"use client";

import Link from "next/link";
import { AlertCircle, Building2, FileText, Clock, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MoneyAmount } from "@/components/ui/money-amount";
import { PageHeader } from "@/components/dashboard/page-header";
import { useI18n } from "@/lib/i18n/provider";
import { displayLocaleFor, formatDate, formatDevisNumber } from "@/lib/format";

export type CommercialClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type CommercialDoc = {
  id: string;
  number: number;
  kind: "devis" | "facture";
  clientName: string;
  object: string | null;
  status: string;
  dueDate: string | null;
  total: number;
};

/**
 * Presentation for the commercial dashboard.
 *
 * What is deliberately absent is as much a part of the design as what is here:
 * no agency revenue, no margin, no collection rate, no worker performance, no
 * client outside this user's own book, and no control that settles an invoice
 * or deletes a record. See docs/audit/PERMISSION-MATRIX.md §3.
 */
export function CommercialDashboardClient({
  firstName,
  clients,
  drafts,
  awaiting,
  overdue,
  pipeline,
  loadError,
}: {
  firstName: string;
  clients: CommercialClientRow[];
  drafts: CommercialDoc[];
  awaiting: CommercialDoc[];
  overdue: CommercialDoc[];
  pipeline: number;
  loadError: string | null;
}) {
  const { t, locale } = useI18n();
  const c = t.commercialUi;
  // "fr" | "en" from the provider; formatDate wants a BCP-47 display locale.
  const displayLocale = displayLocaleFor(locale);

  return (
    <div className="space-y-6">
      <PageHeader title={`${c.greeting} ${firstName}`} description={c.subtitle} />

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-rose-500/35 bg-rose-500/10 p-4"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-ink">{c.errorTitle}</p>
            <p className="text-sm text-ink/70">{c.errorHint}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={c.kpiClients}
          value={clients.length}
          tone="cyan"
          icon={<Building2 size={18} aria-hidden="true" />}
        />
        <KpiCard
          label={c.kpiDrafts}
          value={drafts.length}
          tone="neutral"
          icon={<FileText size={18} aria-hidden="true" />}
          tooltip={c.kpiDraftsHint}
        />
        <KpiCard
          label={c.kpiAwaiting}
          value={awaiting.length}
          tone={overdue.length > 0 ? "amber" : "neutral"}
          icon={<Clock size={18} aria-hidden="true" />}
          tooltip={overdue.length > 0 ? c.kpiOverdueHint(overdue.length) : undefined}
        />
        <KpiCard
          label={c.kpiPipeline}
          value={pipeline}
          suffix=" DT"
          tone="violet"
          icon={<TrendingUp size={18} aria-hidden="true" />}
          tooltip={c.kpiPipelineHint}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{c.draftsTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title={c.draftsEmpty}
                description={c.draftsEmptyHint}
                size="sm"
              />
            ) : (
              <ul className="divide-y divide-[var(--c-border)]">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/dashboard/${d.kind === "facture" ? "factures" : "devis"}/${d.id}`}
                      className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-[var(--c-surface-2)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {d.clientName}
                        </p>
                        <p className="truncate text-xs text-ink/60">
                          {formatDevisNumber(d.number, d.kind)}
                          {d.object ? ` · ${d.object}` : ""}
                        </p>
                      </div>
                      <MoneyAmount amount={d.total} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{c.followUpTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {awaiting.length === 0 ? (
              <EmptyState
                icon={<Clock />}
                title={c.followUpEmpty}
                description={c.followUpEmptyHint}
                size="sm"
              />
            ) : (
              <ul className="divide-y divide-[var(--c-border)]">
                {awaiting.map((d) => {
                  const isOverdue = overdue.some((o) => o.id === d.id);
                  return (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {d.clientName}
                        </p>
                        <p className="truncate text-xs text-ink/60">
                          {d.dueDate
                            ? `${c.dueLabel} ${formatDate(d.dueDate, displayLocale)}`
                            : c.noDeadline}
                        </p>
                      </div>
                      {isOverdue && <Badge tone="amber">{c.overdueBadge}</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{c.clientsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <EmptyState
              icon={<Building2 />}
              title={c.clientsEmpty}
              description={c.clientsEmptyHint}
              action={{ href: "/dashboard/clients/new", label: c.clientsCta }}
              size="sm"
            />
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {clients.map((cl) => (
                <li key={cl.id}>
                  <Link
                    href={`/dashboard/clients/${cl.id}`}
                    className="block rounded-lg border border-[var(--c-border)] p-3 transition-colors hover:bg-[var(--c-surface-2)]"
                  >
                    <p className="truncate text-sm font-medium text-ink">{cl.name}</p>
                    <p className="truncate text-xs text-ink/60">
                      {cl.email ?? cl.phone ?? "—"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-ink/60">{c.scopeNote}</p>
    </div>
  );
}
