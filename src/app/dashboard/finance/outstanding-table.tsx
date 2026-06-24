"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatDt, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "@/components/toast";
import { markContactedAction, createFollowUpTaskAction } from "./finance-actions";

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

function agingBucket(days: number): { label: string; cls: string } {
  if (days <= 0)  return { label: `dans ${Math.abs(days)}j`,    cls: "text-ink/50 bg-ink/6" };
  if (days <= 7)  return { label: `+${days}j`,                  cls: "text-amber-700 bg-amber-50" };
  if (days <= 30) return { label: `+${days}j retard`,           cls: "text-orange-700 bg-orange-50" };
  if (days <= 60) return { label: `+${days}j retard`,           cls: "text-red-600 bg-red-50" };
  return                { label: `+${days}j CRITIQUE`,          cls: "text-red-700 bg-red-100 font-bold" };
}

export function OutstandingTable({ rows }: { rows: OutstandingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-ink/50">
        Aucune facture impayée. Tout est à jour 🎉
      </p>
    );
  }
  return (
    <ul className="divide-y divide-ink/8">
      {rows.map((r) => <OutstandingItem key={r.devis_id} row={r} />)}
    </ul>
  );
}

function OutstandingItem({ row: r }: { row: OutstandingRow }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [, startTransition] = useTransition();
  const aging = agingBucket(r.days_overdue);
  const paidPct = r.total_dt > 0 ? Math.min(100, (r.paid_dt / r.total_dt) * 100) : 0;

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
        r.devis_id, r.devis_number, r.client_name, r.outstanding_dt,
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
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-ink">
              {r.client_id
                ? <Link href={`/dashboard/clients/${r.client_id}`} className="hover:text-brand">{r.client_name}</Link>
                : r.client_name}
            </p>
            {r.contacted && (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                Contacté
              </span>
            )}
          </div>
          <p className="text-xs text-ink/50">
            <Link href={`/dashboard/factures/${r.devis_id}`} className="hover:text-brand">
              Facture #{r.devis_number}
            </Link>
            {" "}· échéance {formatDate(r.due_date)}
          </p>
          {r.paid_dt > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
              </div>
              <span className="text-[10px] text-ink/45">{formatDt(r.paid_dt)} payé</span>
            </div>
          )}
          {r.last_followup_at && (
            <p className="mt-0.5 text-[11px] text-ink/40">
              Dernière relance :{" "}
              {new Date(r.last_followup_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              {r.next_followup_at && (
                <> · Prochaine :{" "}
                  {new Date(r.next_followup_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-sm font-bold text-ink">{formatDt(r.outstanding_dt)}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px]", aging.cls)}>{aging.label}</span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors",
              open ? "bg-brand text-white" : "bg-brand/10 text-brand hover:bg-brand/20",
            )}
          >
            {open ? "Fermer" : "Actions"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-2.5 space-y-3 rounded-xl border border-ink/8 bg-white/60 p-3.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCreateTask}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              📋 Créer tâche relance
            </button>
            <Link
              href={`/dashboard/factures/${r.devis_id}`}
              className="flex items-center justify-center rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-brand/30 hover:text-brand"
            >
              Voir la facture →
            </Link>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
              Note de relance
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Email envoyé, appel passé…"
              className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs text-ink placeholder:text-ink/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
                Prochaine relance
              </label>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              type="button"
              onClick={handleMarkContacted}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
            >
              ✓ Marquer contacté
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
