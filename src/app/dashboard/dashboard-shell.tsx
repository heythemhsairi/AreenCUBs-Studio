"use client";

import { useI18n } from "@/lib/i18n/provider";
import { LanguageToggle } from "@/components/language-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  role: UserRole;
  fullName: string;
  username: string;
};

export function DashboardShell({ role, fullName, username }: Props) {
  const { t } = useI18n();
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

  const title =
    role === "admin"
      ? t.dashboard.admin.title
      : role === "worker"
        ? t.dashboard.worker.title
        : t.dashboard.freelancer.title;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {t.appName}
            </p>
            <p className="text-xs text-slate-500">
              {t.roles[role]} · @{username}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={onSignOut}
              disabled={signingOut}
            >
              {t.nav.logout}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div>
          <p className="text-sm text-slate-500">
            {t.dashboard.welcome}, {fullName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {title}
          </h1>
        </div>

        {role === "admin" && <AdminView />}
        {role === "worker" && <WorkerView />}
        {role === "freelancer" && <FreelancerView />}
      </main>
    </div>
  );
}

function AdminView() {
  const { t } = useI18n();
  const kpis = t.dashboard.admin.kpis;
  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={kpis.revenueMtd} value="—" />
        <KpiCard label={kpis.outstanding} value="—" />
        <KpiCard label={kpis.activeProjects} value="—" />
        <KpiCard label={kpis.activeTasks} value="—" />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Phase 0 ✅</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">{t.dashboard.placeholder}</p>
        </CardContent>
      </Card>
    </>
  );
}

function WorkerView() {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.dashboard.worker.intro}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">{t.dashboard.placeholder}</p>
      </CardContent>
    </Card>
  );
}

function FreelancerView() {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.dashboard.freelancer.intro}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">{t.dashboard.placeholder}</p>
      </CardContent>
    </Card>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}
