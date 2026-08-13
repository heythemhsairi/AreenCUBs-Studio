"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { SectionHeading } from "@/components/dashboard/section-heading";

/**
 * What this person has to deal with, before anything else on the page.
 *
 * ── Why it exists ───────────────────────────────────────────────────────────
 *
 * The commercial and intern dashboards both computed an `overdue` set and then
 * did almost nothing with it. On the commercial dashboard it reached the screen
 * only as the TOOLTIP of a KPI tile — a number you had to hover to discover the
 * meaning of — and as a small badge partway down a follow-up list. On the
 * intern dashboard it was a KPI count and a badge.
 *
 * So both roles opened on a row of summary tiles: correct, calm, and silent
 * about the one thing that needed doing. Counting something is not the same as
 * surfacing it. This puts the actionable items themselves at the top, with the
 * route to act on each, and keeps the tiles as the summary they always were.
 *
 * The administrator overview already worked this way ("Priorités du jour"), so
 * this is the same pattern rather than a new one — and, like that section, it
 * says so explicitly when there is nothing to do, because an empty space does
 * not distinguish "all clear" from "not loaded".
 */

export type ActionItem = {
  id: string;
  href: string;
  /** The thing itself — a client, a task title. */
  primary: string;
  /** Where it comes from — a document number, a project. */
  secondary?: string;
  /** Age, amount, status. Right-aligned. */
  trailing?: ReactNode;
};

export function ActionRequired({
  title,
  items,
  allClearLabel,
  emptyIsGood = true,
}: {
  title: string;
  items: ActionItem[];
  allClearLabel: string;
  /** When false, an empty list renders nothing at all. */
  emptyIsGood?: boolean;
}) {
  if (items.length === 0) {
    if (!emptyIsGood) return null;
    return (
      <section>
        <SectionHeading>{title}</SectionHeading>
        <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success-weak px-5 py-4">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
          <p className="text-sm font-medium text-success">{allClearLabel}</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading action={<span className="num">{items.length}</span>}>
        {title}
      </SectionHeading>

      {/*
        The left rule and the count are the only decoration. This block sits
        above the KPI row, so it has to read as urgent without shouting loudly
        enough to make the rest of the page feel like noise.
      */}
      <div className="overflow-hidden rounded-xl border border-line border-l-2 border-l-danger bg-surface">
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex min-h-[44px] items-center justify-between gap-4 px-4 py-3 transition-colors duration-2 ease-ac hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-content">{item.primary}</p>
                    {item.secondary && (
                      <p className="truncate text-xs text-content-3">{item.secondary}</p>
                    )}
                  </div>
                </div>
                {item.trailing && <div className="shrink-0 text-right">{item.trailing}</div>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
