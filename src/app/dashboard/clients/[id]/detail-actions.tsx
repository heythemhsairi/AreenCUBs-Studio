"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { deleteClientAction } from "../actions";

export function ClientDetailActions({
  clientId,
  isAdmin,
}: {
  clientId: string;
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(t.clients.deleteConfirm)) return;
    const fd = new FormData();
    fd.set("id", clientId);
    startTransition(async () => {
      await deleteClientAction(fd);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Link href={`/dashboard/clients/${clientId}/edit`}>
        <Button variant="outline" size="sm">
          {t.common.edit}
        </Button>
      </Link>
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={onDelete}
          disabled={pending}
        >
          {pending ? t.common.saving : t.common.delete}
        </Button>
      )}
    </div>
  );
}
