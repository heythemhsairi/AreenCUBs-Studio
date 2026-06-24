"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { useI18n } from "@/lib/i18n/provider";

export function ProjectsPageClient() {
  const { t } = useI18n();
  return (
    <PageHeader
      title={t.projectsPage.title}
      action={
        <Link href="/dashboard/projects/new">
          <Button>{t.projectsPage.newProject}</Button>
        </Link>
      }
    />
  );
}
