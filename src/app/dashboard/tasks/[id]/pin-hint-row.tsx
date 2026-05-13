"use client";

import { useI18n } from "@/lib/i18n/provider";
import { PriorityPinButton } from "@/components/priority-pin-button";

export function PinHintRow({
  taskId,
  isPinned,
}: {
  taskId: string;
  isPinned: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3">
      <PriorityPinButton taskId={taskId} initiallyPinned={isPinned} />
      <span className="text-xs text-ink/55">
        {isPinned ? t.taskDetail.pinnedHint : t.taskDetail.pinHint}
      </span>
    </div>
  );
}
