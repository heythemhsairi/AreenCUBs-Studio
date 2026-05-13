"use client";

import { useState, useTransition } from "react";
import { togglePriorityPinAction } from "@/app/dashboard/priority-actions";
import { toast } from "@/components/toast";
import { cn } from "@/lib/utils";

export function PriorityPinButton({
  taskId,
  initiallyPinned,
  className,
}: {
  taskId: string;
  initiallyPinned: boolean;
  className?: string;
}) {
  const [pinned, setPinned] = useState(initiallyPinned);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !pinned;
    setPinned(next); // optimistic
    startTransition(async () => {
      const res = await togglePriorityPinAction(taskId);
      if (!res.ok) {
        setPinned(!next);
        toast.error(res.error);
      } else if (next) {
        toast.success("Épinglé dans vos priorités du jour");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={
        pinned
          ? "Désépingler de mes priorités du jour"
          : "Épingler dans mes priorités du jour (max 3)"
      }
      aria-label={pinned ? "Désépingler" : "Épingler"}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-all hover:scale-110",
        pinned
          ? "text-accent hover:text-accent-dark"
          : "text-ink/30 hover:text-accent",
        pending && "opacity-60",
        className,
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
    </button>
  );
}
