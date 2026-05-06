"use client";

import { useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteTaskAction } from "../actions";

export function TaskDeleteButton({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(t.tasks.deleteConfirm)) return;
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("project_id", projectId);
    startTransition(async () => {
      await deleteTaskAction(fd);
    });
  }

  return (
    <Card className="max-w-2xl border-red-200">
      <CardHeader>
        <CardTitle className="text-red-700">{t.common.delete}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={onDelete}
          disabled={pending}
        >
          {pending ? t.common.saving : t.tasks.deleteConfirm}
        </Button>
      </CardContent>
    </Card>
  );
}
