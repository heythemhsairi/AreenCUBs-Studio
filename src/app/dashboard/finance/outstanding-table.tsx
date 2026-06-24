"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDt, formatDate, formatDevisNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "@/components/toast";
import {
  markContactedAction,
  createFollowUpTaskAction,
} from "./finance-actions";

export type OutstandingRow = {
  devis_id: string;
  devis_number: number;
  client_id: string | null;
  client_name: string;
  total_dt: number;
  paid_dt: number;
  outstanding_dt: number;
  due_date: string;
  days_overdue: number;
  last_followup_at?: string | null;
  next_followup_at?: string | null;
  contacted?: boolean;
};

export function OutstandingTable({ rows }: { rows: OutstandingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Aucun impayé. Tout est à jour 🎉
      </p>
    );
  }

  return (
    <ul className="divide-y divide-ink/8">
      {rows.map((r) => (
        <OutstandingRow key={r.devis_id} row={r} />
      ))}
    </ul>
  );
}

function OutstandingRow({ row: r }: { row: OutstandingRow }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [pending, startTransition] = useTransition();

  function handleMarkContacted() {
    startTransition(async () => {
      const res = await markContactedAction(r.devis_id, note, nextDate || null);
      if (res.ok) {
        toast.success("Relance enregistrée");
        setOpen(false);
        setNote("");
        setNextDate("");
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleCreateTask() {
    startTransition(async () => {
      const res = await createFollowUpTaskAction(
        r.devis_id,
        r.devis_number,
        r.client_name,
        r.outstanding_dt,
      );
      if (res.ok) {
        toast.success("Tâche de relance créée");
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-ink">
              {r.client_id ? (
                <Link
                  href={`/dashboard/clients/${r.client_id}`}
                  className="hover:text-brand"
                >
                  {r.client_name}
                </Link>
              ) : (
                r.client_name
              )}
            </p>
            {r.contacted && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                Contacté
              </span>
            )}
          </div>
          <p className="text-xs text-ink/50">
            <Link
              href={`/dashboard/devis/${r.devis_id}`}
              className="hover:text-brand"
            >
              {formatDevisNumber(r.devis_number)}
            </Link>{" "}
            · échéance {formatDate(r.due_date)}
          </p>
          {r.last_followup_at && (
            <p className="text-[11px] text-ink/40">
              Dernière relance :{" "}
              {new Date(r.last_followup_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
              {r.next_followup_at && (
                <> · Prochaine :{" "}
                  {new Date(r.next_followup_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-sm font-semibold text-ink">
            {formatDt(r.outstanding_dt)}
          </span>
          <OverdueBadge days={r.days_overdue} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors",
              open
                ? "bg-brand text-white"
                : "bg-brand/10 text-brand hover:bg-brand/20",
            )}
          >
            {open ? "Fermer" : "Actions"}
          </button>
        </div>
      </div>

      {/* Inline action panel */}
      {open && (
        <div className="mt-2 rounded-lg border border-ink/8 bg-white/60 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <ActionButton
              label="📋 Créer tâche relance"
              onClick={handleCreateTask}
              disabled={pending}
              tone="brand"
            />
            <Link
              href={`/dashboard/devis/${r.devis_id}`}
              className="flex items-center justify-center rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-brand/30 hover:text-brand"
            >
              Voir le devis →
            </Link>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-ink/55 uppercase tracking-wider">
              Note de relance
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Email envoyé, appel passé…"
              className="w-full rounded-md border border-ink/10 bg-white px-2.5 py-1.5 text-xs text-ink placeholder:text-ink/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-ink/55 uppercase tracking-wider">
                  Prochaine relance
                </label>
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-ink/10 bg-white px-2.5 py-1.5 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <ActionButton
                label={pending ? "…" : "✓ Marquer contacté"}
                onClick={handleMarkContacted}
                disabled={pending}
                tone="green"
                className="mt-4 self-end"
              />
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  tone,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "brand" | "green";
  className?: string;
}) {
  const colors =
    tone === "green"
      ? "bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-200"
      : "bg-brand text-white hover:bg-brand-dark disabled:bg-brand/50";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
        colors,
        className,
      )}
    >
      {label}
    </button>
  );
}

function OverdueBadge({ days }: { days: number }) {
  if (days < 0) {
    return <Badge tone="slate">dans {Math.abs(days)}j</Badge>;
  }
  if (days === 0) {
    return <Badge tone="amber">aujourd&apos;hui</Badge>;
  }
  if (days <= 7) {
    return <Badge tone="amber">+{days}j</Badge>;
  }
  return <Badge tone="red">+{days}j retard</Badge>;
}
