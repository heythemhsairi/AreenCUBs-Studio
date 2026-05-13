"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { formatDt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toggleServiceActiveAction } from "./actions";

type Service = {
  id: string;
  name_fr: string;
  name_en: string | null;
  description_fr: string | null;
  category: string | null;
  default_price_dt: number;
  default_unit: string;
  active: boolean;
};

type ActiveFilter = "all" | "active" | "inactive";
type Sort = "name" | "price_desc" | "price_asc";

export function ServicesList({ services }: { services: Service[] }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [sort, setSort] = useState<Sort>("name");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of services) if (s.category) set.add(s.category);
    return Array.from(set).sort();
  }, [services]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = services;
    if (q.length > 0) {
      rows = rows.filter((s) =>
        `${s.name_fr} ${s.name_en ?? ""} ${s.description_fr ?? ""} ${s.category ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    if (category !== "all") {
      rows = rows.filter((s) => s.category === category);
    }
    if (activeFilter !== "all") {
      const want = activeFilter === "active";
      rows = rows.filter((s) => s.active === want);
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "price_desc") return b.default_price_dt - a.default_price_dt;
      if (sort === "price_asc") return a.default_price_dt - b.default_price_dt;
      return a.name_fr.localeCompare(b.name_fr);
    });
    return rows;
  }, [services, search, category, activeFilter, sort]);

  if (services.length === 0) {
    return <EmptyState>{t.servicesUi.noResults}</EmptyState>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.servicesUi.title}
        description={t.servicesUi.description}
        action={
          <Link href="/dashboard/services/new">
            <Button>{t.servicesUi.newService}</Button>
          </Link>
        }
      />
      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 md:px-5">
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.filters.searchService}
            className="w-full rounded-lg border border-ink/10 bg-white/70 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-lg border border-ink/10 bg-white/70 px-3 text-xs font-medium text-ink/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          >
            <option value="all">{t.filters.allCategories}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        <div className="inline-flex items-center rounded-lg border border-ink/10 bg-white/60 p-0.5">
          {(["all", "active", "inactive"] as ActiveFilter[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setActiveFilter(a)}
              aria-pressed={activeFilter === a}
              className={cn(
                "h-7 rounded-md px-3 text-xs font-medium transition-all",
                activeFilter === a
                  ? "bg-brand text-white shadow-sm"
                  : "text-ink/60 hover:bg-white/80 hover:text-ink",
              )}
            >
              {a === "all"
                ? t.common.all
                : a === "active"
                  ? t.filters.active
                  : t.filters.inactive}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-9 rounded-lg border border-ink/10 bg-white/70 px-3 text-xs font-medium text-ink/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="name">{t.common.nameAZ}</option>
          <option value="price_desc">{t.common.priceDesc}</option>
          <option value="price_asc">{t.common.priceAsc}</option>
        </select>

        <span className="ml-auto rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/65">
          {filtered.length} {filtered.length > 1 ? "services" : "service"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center gap-2 rounded-2xl px-6 py-16 text-center">
          <span className="text-3xl">🔍</span>
          <p className="text-sm font-medium text-ink">
            {t.servicesUi.noResults}
          </p>
          <p className="text-xs text-ink/55">{t.servicesUi.noResultsHint}</p>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t.servicesUi.columns.name}</TH>
              <TH>{t.servicesUi.columns.category}</TH>
              <TH className="text-right">{t.servicesUi.columns.price}</TH>
              <TH>{t.servicesUi.columns.unit}</TH>
              <TH>{t.servicesUi.columns.active}</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {filtered.map((s) => (
              <Row key={s.id} svc={s} />
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function Row({ svc }: { svc: Service }) {
  const [pending, startTransition] = useTransition();

  function onToggle(next: boolean) {
    startTransition(async () => {
      await toggleServiceActiveAction(svc.id, next);
    });
  }

  return (
    <TR>
      <TD className="font-medium text-ink">
        <Link
          href={`/dashboard/services/${svc.id}`}
          className="hover:text-brand"
        >
          {svc.name_fr}
        </Link>
        {svc.description_fr && (
          <p className="mt-0.5 truncate text-xs text-ink/50">
            {svc.description_fr}
          </p>
        )}
      </TD>
      <TD className="text-ink/65">{svc.category ?? "—"}</TD>
      <TD className="text-right font-semibold text-ink">
        {formatDt(svc.default_price_dt)}
      </TD>
      <TD className="text-ink/65">{svc.default_unit}</TD>
      <TD>
        <button
          type="button"
          onClick={() => onToggle(!svc.active)}
          disabled={pending}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            svc.active ? "bg-brand" : "bg-ink/15"
          } ${pending ? "opacity-60" : ""}`}
          aria-pressed={svc.active}
          aria-label={svc.active ? "Désactiver" : "Activer"}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              svc.active ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </TD>
      <TD className="text-right">
        <Link
          href={`/dashboard/services/${svc.id}`}
          className="text-sm font-medium text-brand hover:text-brand-dark"
        >
          Modifier
        </Link>
      </TD>
    </TR>
  );
}
