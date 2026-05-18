"use client";

import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

export type AssigneeOption = {
  id: string;
  label: string;
  avatar_url?: string | null;
};

/**
 * Multi-select people picker. Renders selectable chips and emits one
 * hidden <input name={name}> per selected id so it works inside a plain
 * <form> that reads FormData (server actions use formData.getAll).
 */
export function MultiAssignee({
  people,
  defaultSelected = [],
  name = "assignee_ids",
  emptyLabel = "Personne",
}: {
  people: AssigneeOption[];
  defaultSelected?: string[];
  name?: string;
  emptyLabel?: string;
}) {
  const [selected, setSelected] = useState<string[]>(
    defaultSelected.filter((id) => people.some((p) => p.id === id)),
  );

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {people.length === 0 && (
          <span className="text-xs text-ink/40">{emptyLabel}</span>
        )}
        {people.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              aria-pressed={on}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-all",
                on
                  ? "border-brand/50 bg-brand/15 text-brand-dark dark:text-brand"
                  : "border-ink/12 bg-white/60 text-ink/60 hover:border-ink/25 hover:bg-white/90 dark:bg-white/5",
              )}
            >
              <Avatar src={p.avatar_url ?? null} name={p.label} size="xs" />
              <span className="max-w-[140px] truncate">{p.label}</span>
              {on && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  );
}
