"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

export type AssigneeOption = {
  id: string;
  label: string;
  avatar_url?: string | null;
};

/**
 * Compact multi-select people picker. Shows only the selected people as
 * removable chips plus an "Add" button that opens a searchable dropdown —
 * it does NOT lay every member out at once. Emits one hidden
 * <input name={name}> per selected id so it works inside a plain <form>
 * read with FormData (server actions use formData.getAll).
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }
  }, [open]);

  const byId = useMemo(
    () => Object.fromEntries(people.map((p) => [p.id, p])),
    [people],
  );
  const chosen = selected.map((id) => byId[id]).filter(Boolean);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.label.toLowerCase().includes(q));
  }, [people, query]);

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {chosen.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/12 py-1 pl-1 pr-2 text-xs font-medium text-brand-dark dark:text-brand"
          >
            <Avatar src={p.avatar_url ?? null} name={p.label} size="xs" />
            <span className="max-w-[140px] truncate">{p.label}</span>
            <button
              type="button"
              onClick={() => toggle(p.id)}
              aria-label={`Retirer ${p.label}`}
              className="text-brand-dark/50 transition-colors hover:text-red-600 dark:text-brand/60"
            >
              ×
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium transition-colors",
            open
              ? "border-brand/50 bg-brand/10 text-brand-dark dark:text-brand"
              : "border-ink/25 text-ink/55 hover:border-brand/40 hover:text-ink",
          )}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {chosen.length === 0 ? emptyLabel : "Ajouter"}
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-ink/10 bg-white shadow-lift dark:border-white/10 dark:bg-[#1e2029]">
          <div className="border-b border-ink/8 p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full rounded-md border border-ink/10 bg-white/70 px-2.5 py-1.5 text-xs text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 dark:bg-white/5"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-ink/40">—</li>
            )}
            {filtered.map((p) => {
              const on = selected.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                      on
                        ? "bg-brand/10 text-brand-dark dark:text-brand"
                        : "text-ink/75 hover:bg-ink/5",
                    )}
                  >
                    <Avatar
                      src={p.avatar_url ?? null}
                      name={p.label}
                      size="xs"
                    />
                    <span className="min-w-0 flex-1 truncate">{p.label}</span>
                    {on && (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  );
}
