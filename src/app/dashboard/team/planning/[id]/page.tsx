import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { WorkCalendar } from "@/components/work-calendar";
import type { UserRole } from "@/lib/utils";

const roleTone: Record<UserRole, "violet" | "blue" | "green"> = {
  admin: "violet",
  worker: "blue",
  freelancer: "green",
};

const roleLabel: Record<UserRole, string> = {
  admin: "Administrateur",
  worker: "Collaborateur",
  freelancer: "Freelance",
};

export default async function MemberPlanningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const admin = createAdminClient();

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

  const scheduleMap: Record<string, "office" | "home"> = {};
  for (const r of schedule ?? []) {
    scheduleMap[r.date as string] = r.location as "office" | "home";
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
  for (const r of schedule ?? []) {
    const d = r.date as string;
    if (d < monthStart || d > monthEnd) continue;
    if (r.location === "office") officeMonth++;
    else if (r.location === "home") homeMonth++;
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
              <Badge tone={roleTone[role]}>{roleLabel[role]}</Badge>
            </div>
            {profile.job_title && (
              <p className="mt-1 text-sm text-ink/65">{profile.job_title}</p>
            )}
            <p className="mt-0.5 text-xs text-ink/45">@{profile.username}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
              <Stat label="🏢 Bureau (ce mois)" value={officeMonth} tone="brand" />
              <Stat label="🏠 Maison (ce mois)" value={homeMonth} tone="accent" />
              <Stat
                label="Total enregistré"
                value={officeMonth + homeMonth}
                tone="neutral"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendrier mensuel</CardTitle>
          <p className="text-xs text-ink/55">
            En tant qu&apos;administrateur, vous pouvez modifier les jours
            de {profile.full_name ?? profile.username}. Cliquez un jour pour
            basculer entre Bureau, Maison et vide.
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
  tone: "brand" | "accent" | "neutral";
}) {
  const cls =
    tone === "brand"
      ? "bg-brand/10 text-brand-dark ring-brand/20"
      : tone === "accent"
        ? "bg-accent/15 text-accent-dark ring-accent/30"
        : "bg-ink/5 text-ink/70 ring-ink/10";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${cls}`}
    >
      <span>{label}</span>
      <span className="text-base">{value}</span>
    </span>
  );
}
