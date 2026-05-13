"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

type Status = "active" | "on_hold" | "completed" | "cancelled";

export function ProjectDetailsCard({
  project,
  ownerName,
}: {
  project: {
    status: Status;
    end_date: string | null;
    description: string | null;
  };
  ownerName: string;
}) {
  const { t, locale } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.common.details}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/55">
            {t.projects.columns.status}
          </p>
          <Badge
            tone={
              project.status === "active"
                ? "blue"
                : project.status === "completed"
                  ? "green"
                  : project.status === "on_hold"
                    ? "amber"
                    : "slate"
            }
          >
            {t.projects.status[project.status] ?? project.status}
          </Badge>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/55">
            {t.projects.columns.owner}
          </p>
          <p className="text-ink/85">{ownerName}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/55">
            {t.projects.columns.deadline}
          </p>
          <p className="text-ink/85">
            {project.end_date
              ? new Date(project.end_date).toLocaleDateString(
                  locale === "en" ? "en-US" : "fr-FR",
                )
              : "—"}
          </p>
        </div>
        {project.description && (
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/55">
              {t.projects.form.description}
            </p>
            <p className="whitespace-pre-wrap text-ink/85">
              {project.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TasksSectionHeader({
  projectId,
  isFreelancer,
}: {
  projectId: string;
  isFreelancer: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-semibold text-ink">{t.tasks.title}</h2>
      {!isFreelancer && (
        <Link href={`/dashboard/tasks/new?projectId=${projectId}`}>
          <Button size="sm">{t.tasksUi.newTaskCta}</Button>
        </Link>
      )}
    </div>
  );
}
