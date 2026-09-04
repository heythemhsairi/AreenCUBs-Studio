"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  buildMonthGrid,
  groupEntriesByDate,
  isSameUtcDay,
  isSameUtcMonth,
  parseDateKey,
  shiftMonth,
  toDateKey,
  type PortalCalendarEntry,
} from "@/lib/portal/calendar";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_FORMATTER = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function MiniCalendar({ entries, nowIso }: { entries: PortalCalendarEntry[]; nowIso: string }) {
  const today = useMemo(() => parseDateKey(nowIso.slice(0, 10)), [nowIso]);
  const sortedKeys = useMemo(() => [...entries].map((e) => e.date).sort(), [entries]);
  const firstUpcoming = sortedKeys.find((key) => key >= toDateKey(today)) ?? sortedKeys[0];
  const initial = firstUpcoming ? parseDateKey(firstUpcoming) : today;

  const [cursor, setCursor] = useState({ year: initial.getUTCFullYear(), month: initial.getUTCMonth() });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const entriesByDate = useMemo(() => groupEntriesByDate(entries), [entries]);
  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const selectedEntries = selectedKey ? (entriesByDate.get(selectedKey) ?? []) : [];

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Aucune date partagée"
        description="Les prochaines publications et échéances apparaîtront ici."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold capitalize text-content">
          {MONTH_FORMATTER.format(new Date(Date.UTC(cursor.year, cursor.month, 1)))}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
            aria-label="Mois précédent"
            className="flex h-8 w-8 items-center justify-center rounded-md text-content-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCursor({ year: today.getUTCFullYear(), month: today.getUTCMonth() })}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-content-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
            aria-label="Mois suivant"
            className="flex h-8 w-8 items-center justify-center rounded-md text-content-2 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[280px] grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-content-3">
              {day}
            </div>
          ))}
          {grid.map((date) => {
            const key = toDateKey(date);
            const dayEntries = entriesByDate.get(key) ?? [];
            const inMonth = isSameUtcMonth(date, cursor.year, cursor.month);
            const isToday = isSameUtcDay(date, today);
            const isSelected = key === selectedKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey((prev) => (prev === key ? null : key))}
                disabled={dayEntries.length === 0}
                aria-pressed={isSelected}
                aria-label={`${DAY_FORMATTER.format(date)}${dayEntries.length ? `, ${dayEntries.length} élément${dayEntries.length > 1 ? "s" : ""}` : ""}`}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md text-xs transition-colors duration-2 ease-ac",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent2",
                  !inMonth && "text-content-3/50",
                  inMonth && !isSelected && "text-content-2",
                  isSelected && "bg-brand/15 font-semibold text-brand",
                  !isSelected && dayEntries.length > 0 && "hover:bg-surface-2",
                  isToday && !isSelected && "ring-1 ring-inset ring-brand/40",
                  dayEntries.length === 0 && "cursor-default",
                )}
              >
                <span>{date.getUTCDate()}</span>
                {dayEntries.length > 0 && (
                  <span className="flex gap-0.5" aria-hidden="true">
                    {dayEntries.slice(0, 3).map((entry) => (
                      <span
                        key={entry.id}
                        className={cn(
                          "h-1 w-1 rounded-full",
                          entry.kind === "publication" ? "bg-brand" : "bg-content-3",
                        )}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-content-3">
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" /> Publication</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-content-3" aria-hidden="true" /> Échéance de tâche</span>
      </div>

      {selectedKey && (
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-xs font-medium capitalize text-content-2">{DAY_FORMATTER.format(parseDateKey(selectedKey))}</p>
          <ul className="space-y-1.5">
            {selectedEntries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 text-sm text-content">
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", entry.kind === "publication" ? "bg-brand" : "bg-content-3")}
                  aria-hidden="true"
                />
                {entry.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
