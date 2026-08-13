import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { WorkCalendar } from "@/components/work-calendar";
import type { UserRole } from "@/lib/utils";
import { ROLE_TONE, ROLE_LABEL_FR } from "@/lib/roles";
import type { WorkLocation } from "@/lib/work-schedule";





export default async function MemberPlanningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = await createClient();

  // 3-month window centered on the current month (same as worker overview)
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
    .toISOString()
    .slice(0, 10);

  const [{ data: profile }, { data: schedule }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, full_name, avatar_url, role, job_title")
      .eq("id", id)
      .single(),
    admin
      .from("work_schedule")
      .select("date, location")
      .eq("user_id", id)
      .gte("date", start)
      .lte("date", end),
  ]);

  if (!profile) notFound();

  const scheduleMap: Record<string, WorkLocation> = {};
  for (const r of schedule ?? []) {
    scheduleMap[r.date as string] = r.location as WorkLocation;
  }

  // Current-month totals for the summary stats
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  let officeMonth = 0;
  let homeMonth = 0;
  let absenceMonth = 0;
  let vacationMonth = 0;
  for (const r of schedule ?? []) {
    const d = r.date as string;
    if (d < monthStart || d > monthEnd) continue;
    if (r.location === "office") officeMonth++;
    else if (r.location === "home") homeMonth++;
    else if (r.location === "absence") absenceMonth++;
    else if (r.location === "vacation") vacationMonth++;
  }

  const role = profile.role as UserRole;

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.full_name ?? profile.username}
        subtitle={
          <Link
            href="/dashboard/team/planning"
            className="hover:underline"
          >
            ← Planning équipe
          </Link>
        }
      />

      <Card>
        <CardContent className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-start">
          <Avatar
            src={profile.avatar_url}
            name={profile.full_name ?? profile.username}
            size="xl"
          />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                {profile.full_name ?? profile.username}
              </h2>
              <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL_FR[role]}</Badge>
            </div>
            {profile.job_title && (
              <p className="mt-1 text-sm text-content-3">{profile.job_title}</p>
            )}
            <p className="mt-0.5 text-xs text-content-3">@{profile.username}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
              <Stat label="🏢 Bureau (ce mois)" value={officeMonth} tone="brand" />
              <Stat label="🏠 Maison (ce mois)" value={homeMonth} tone="info" />
              <Stat label="⛔ Absence (ce mois)" value={absenceMonth} tone="warning" />
              <Stat label="🌴 Congé (ce mois)" value={vacationMonth} tone="success" />
              <Stat
                label="Total enregistré"
                value={officeMonth + homeMonth + absenceMonth + vacationMonth}
                tone="neutral"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendrier mensuel</CardTitle>
          <p className="text-xs text-content-3">
            En tant qu&apos;administrateur, vous pouvez modifier les jours
            de {profile.full_name ?? profile.username}. Sélectionnez Bureau,
            Maison, Absence, Congé ou Effacer, puis appliquez ce statut aux jours voulus.
          </p>
        </CardHeader>
        <CardContent>
          <WorkCalendar
            initial={scheduleMap}
            targetUserId={profile.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "info" | "warning" | "success" | "neutral";
}) {
  const cls = {
    brand: "bg-brand/10 text-brand ring-brand/20",
    info: "bg-info-weak text-info ring-info/20",
    warning: "bg-warning-weak text-warning ring-warning/20",
    success: "bg-success-weak text-success ring-success/20",
    neutral: "bg-ink/5 text-content-2 ring-ink/10",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${cls}`}
    >
      <span>{label}</span>
      <span className="text-base">{value}</span>
    </span>
  );
}
