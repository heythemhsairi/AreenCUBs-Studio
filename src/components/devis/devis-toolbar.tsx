"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

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
  const { t } = useI18n();

  function patch<K extends keyof DevisFilters>(key: K, value: DevisFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const activeCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.payment !== "all" ? 1 : 0) +
    (filters.clientId !== "all" ? 1 : 0) +
    (filters.date !== "all" ? 1 : 0) +
    (filters.search.trim().length > 0 ? 1 : 0);

  const statusOptions: Option[] = [
    { value: "all", label: t.common.all },
    { value: "draft", label: t.devis.status.draft },
    { value: "sent", label: t.devis.status.sent },
    { value: "accepted", label: t.devis.status.accepted },
    { value: "rejected", label: t.devis.status.rejected },
  ];

  const paymentOptions: Option[] = [
    { value: "all", label: t.common.all },
    { value: "unpaid", label: t.devis.payment.unpaid },
    { value: "partial", label: t.devis.payment.partial },
    { value: "paid", label: t.devis.payment.paid },
  ];

  const clientOptions: Option[] = [
    { value: "all", label: t.filters.allClients },
    ...clients,
  ];

  const dateOptions: Option[] = [
    { value: "all", label: t.common.all },
    { value: "month", label: t.common.thisMonth },
    { value: "quarter", label: t.common.thisQuarter },
    { value: "year", label: t.filters.thisYear },
    { value: "overdue", label: t.filters.overdue },
  ];

  return (
    <div className="rounded-2xl border border-[#263244] bg-[#111827] px-4 py-3 md:px-5">
      {/* Search row */}
      <div className="relative mb-3">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]"
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
          placeholder={t.filters.searchDevis}
          className="w-full rounded-lg border border-[#263244] bg-[#18212F] py-2 pl-9 pr-3 text-sm text-[#F8FAFC] placeholder:text-[#64748B] transition-colors focus:border-[#22D3EE] focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/20"
        />
      </div>

      {/* Filters row — horizontal scroll on mobile, wrap on desktop */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {/* Mobile: native selects for compact no-break chips */}
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <NativeSelect
            label={t.filters.status}
            value={filters.status}
            options={statusOptions}
            onChange={(v) => patch("status", v as DevisFilters["status"])}
            active={filters.status !== "all"}
          />
          <NativeSelect
            label={t.filters.payment}
            value={filters.payment}
            options={paymentOptions}
            onChange={(v) => patch("payment", v as DevisFilters["payment"])}
            active={filters.payment !== "all"}
          />
          {clients.length > 0 && (
            <NativeSelect
              label={t.filters.client}
              value={filters.clientId}
              options={clientOptions}
              onChange={(v) => patch("clientId", v)}
              active={filters.clientId !== "all"}
            />
          )}
          <NativeSelect
            label={t.filters.period}
            value={filters.date}
            options={dateOptions}
            onChange={(v) => patch("date", v as DevisFilters["date"])}
            active={filters.date !== "all"}
          />
        </div>

        {/* Desktop: dropdown menus */}
        <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
          <FilterMenu
            label={t.filters.status}
            value={filters.status}
            options={statusOptions}
            onChange={(v) => patch("status", v as DevisFilters["status"])}
          />
          <FilterMenu
            label={t.filters.payment}
            value={filters.payment}
            options={paymentOptions}
            onChange={(v) => patch("payment", v as DevisFilters["payment"])}
          />
          {clients.length > 0 && (
            <FilterMenu
              label={t.filters.client}
              value={filters.clientId}
              options={clientOptions}
              onChange={(v) => patch("clientId", v)}
            />
          )}
          <FilterMenu
            label={t.filters.period}
            value={filters.date}
            options={dateOptions}
            onChange={(v) => patch("date", v as DevisFilters["date"])}
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_DEVIS_FILTERS })}
              className="rounded-md px-2 py-1 text-xs font-medium text-[#94A3B8] transition-colors hover:bg-[#263244] hover:text-[#F8FAFC]"
            >
              {t.common.clear} ({activeCount})
            </button>
          )}
          <span className="rounded-md bg-[#263244] px-2 py-1 text-xs font-medium text-[#94A3B8]">
            {t.devisUi.itemsLabel(resultCount, kind)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Mobile native select chip ──────────────────────────────────────── */

function NativeSelect({
  label,
  value,
  options,
  onChange,
  active,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  active: boolean;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          "h-8 appearance-none rounded-full border pl-3 pr-6 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30",
          active
            ? "border-[#22D3EE]/40 bg-[#22D3EE]/10 text-[#22D3EE]"
            : "border-[#263244] bg-[#18212F] text-[#94A3B8]",
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#111827] text-[#F8FAFC]">
            {opt.value === "all" ? label : opt.label}
          </option>
        ))}
      </select>
      {/* Chevron overlay */}
      <svg
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[#64748B]"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
      {/* Active dot */}
      {active && selected && (
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#22D3EE]" />
      )}
    </div>
  );
}

/* ── Desktop dropdown menu ──────────────────────────────────────────── */

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
          "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap",
          isActive
            ? "border-[#22D3EE]/40 bg-[#22D3EE]/10 text-[#22D3EE]"
            : "border-[#263244] bg-[#18212F] text-[#94A3B8] hover:border-[#22D3EE]/20 hover:text-[#F8FAFC]",
        )}
      >
        <span className="text-[#64748B]">{label}:</span>
        <span className="font-semibold">{selected?.label ?? "Tous"}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 min-w-[180px] overflow-hidden rounded-lg border border-[#263244] bg-[#111827] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
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
                      ? "bg-[#22D3EE]/10 font-semibold text-[#22D3EE]"
                      : "text-[#94A3B8] hover:bg-[#1E2A3A] hover:text-[#F8FAFC]",
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
