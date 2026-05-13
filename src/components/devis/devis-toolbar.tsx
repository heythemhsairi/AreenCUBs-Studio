"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type DevisFilters = {
  search: string;
  status: "all" | "draft" | "sent" | "accepted" | "rejected";
  payment: "all" | "unpaid" | "partial" | "paid";
  clientId: string;
  date: "all" | "month" | "quarter" | "year" | "overdue";
};

export const DEFAULT_DEVIS_FILTERS: DevisFilters = {
  search: "",
  status: "all",
  payment: "all",
  clientId: "all",
  date: "all",
};

type Option = { value: string; label: string };

export function DevisToolbar({
  filters,
  onChange,
  clients,
  resultCount,
  kind,
}: {
  filters: DevisFilters;
  onChange: (next: DevisFilters) => void;
  clients: Option[];
  resultCount: number;
  kind: "devis" | "facture";
}) {
  function patch<K extends keyof DevisFilters>(
    key: K,
    value: DevisFilters[K],
  ) {
    onChange({ ...filters, [key]: value });
  }

  const activeCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.payment !== "all" ? 1 : 0) +
    (filters.clientId !== "all" ? 1 : 0) +
    (filters.date !== "all" ? 1 : 0) +
    (filters.search.trim().length > 0 ? 1 : 0);

  const noun = kind === "facture" ? "facture" : "devis";

  return (
    <div className="glass rounded-2xl px-4 py-3 md:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={filters.search}
            onChange={(e) => patch("search", e.target.value)}
            placeholder={`Rechercher un numéro, client, objet…`}
            className="w-full rounded-lg border border-ink/10 bg-white/70 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <FilterMenu
          label="Statut"
          value={filters.status}
          options={[
            { value: "all", label: "Tous" },
            { value: "draft", label: "Brouillon" },
            { value: "sent", label: "Envoyé" },
            { value: "accepted", label: "Accepté" },
            { value: "rejected", label: "Refusé" },
          ]}
          onChange={(v) => patch("status", v as DevisFilters["status"])}
        />

        <FilterMenu
          label="Paiement"
          value={filters.payment}
          options={[
            { value: "all", label: "Tous" },
            { value: "unpaid", label: "Impayé" },
            { value: "partial", label: "Partiel" },
            { value: "paid", label: "Payé" },
          ]}
          onChange={(v) => patch("payment", v as DevisFilters["payment"])}
        />

        <FilterMenu
          label="Client"
          value={filters.clientId}
          options={[{ value: "all", label: "Tous les clients" }, ...clients]}
          onChange={(v) => patch("clientId", v)}
        />

        <FilterMenu
          label="Période"
          value={filters.date}
          options={[
            { value: "all", label: "Toutes" },
            { value: "month", label: "Ce mois" },
            { value: "quarter", label: "Ce trimestre" },
            { value: "year", label: "Cette année" },
            { value: "overdue", label: "En retard" },
          ]}
          onChange={(v) => patch("date", v as DevisFilters["date"])}
        />

        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_DEVIS_FILTERS })}
              className="rounded-md px-2 py-1 text-xs font-medium text-ink/60 transition-colors hover:bg-white/60 hover:text-ink"
            >
              Effacer ({activeCount})
            </button>
          )}
          <span className="rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/65">
            {resultCount} {resultCount > 1 ? `${noun}s` : noun}
          </span>
        </div>
      </div>
    </div>
  );
}

function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const isActive = value !== "all";

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
          isActive
            ? "border-brand/40 bg-brand/10 text-brand-dark"
            : "border-ink/10 bg-white/70 text-ink/70 hover:border-ink/20 hover:bg-white/95",
        )}
      >
        <span className="text-ink/50">{label}:</span>
        <span className="font-semibold">{selected?.label ?? "Tous"}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 min-w-[200px] overflow-hidden rounded-lg border border-ink/8 bg-white/95 shadow-lift backdrop-blur dark:bg-ink/95">
          <ul className="max-h-72 overflow-y-auto py-1">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors",
                    opt.value === value
                      ? "bg-brand/10 font-semibold text-brand-dark"
                      : "text-ink/75 hover:bg-ink/5",
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.value === value && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
