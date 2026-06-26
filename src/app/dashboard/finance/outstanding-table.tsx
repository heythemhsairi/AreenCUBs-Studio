"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatDt, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "@/components/toast";
import { markContactedAction, createFollowUpTaskAction } from "./finance-actions";
import { useI18n } from "@/lib/i18n/provider";

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

type TF = ReturnType<typeof useI18n>["t"]["finance"];
type TC = ReturnType<typeof useI18n>["t"]["common"];

function agingBucket(tf: TF, days: number): { label: string; cls: string } {
  if (days <= 0)  return { label: tf.outstandingAgingUpcoming(Math.abs(days)), cls: "text-[#94A3B8] bg-[#1A3E5C]" };
  if (days <= 7)  return { label: tf.outstandingAgingWarning(days),            cls: "text-amber-400 bg-amber-900/30" };
  if (days <= 30) return { label: tf.outstandingAgingLate(days),               cls: "text-orange-400 bg-orange-900/30" };
  if (days <= 60) return { label: tf.outstandingAgingLate(days),               cls: "text-red-400 bg-red-900/30" };
  return               { label: tf.outstandingAgingCritical(days),             cls: "text-red-300 bg-red-900/50 font-bold" };
}

export function OutstandingTable({ rows }: { rows: OutstandingRow[] }) {
  const { t } = useI18n();
  const tf = t.finance;

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[#64748B]">
        {tf.outstandingEmpty}
      </p>
    );
  }

  return (
    <>
      {/* Mobile: card list */}
      <ul className="md:hidden space-y-2">
        {rows.map((r) => (
          <OutstandingCard key={r.devis_id} row={r} />
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#22506F]">
              <Th>{tf.colClient}</Th>
              <Th>{tf.outstandingColFacture}</Th>
              <Th>{tf.colDue}</Th>
              <Th right>{tf.outstandingColAmount}</Th>
              <Th center>{tf.outstandingColDelay}</Th>
              <Th center>{tf.outstandingColActions}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#22506F]">
            {rows.map((r) => (
              <OutstandingTableRow key={r.devis_id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) {
  return (
    <th className={cn(
      "py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[#64748B]",
      right ? "text-right" : center ? "text-center" : "text-left",
    )}>
      {children}
    </th>
  );
}

function OutstandingCard({ row: r }: { row: OutstandingRow }) {
  const { t, locale } = useI18n();
  const tf = t.finance;
  const tc = t.common;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [, startTransition] = useTransition();
  const aging = agingBucket(tf, r.days_overdue);
  const paidPct = r.total_dt > 0 ? Math.min(100, (r.paid_dt / r.total_dt) * 100) : 0;

  function fmtFollowup(iso: string) {
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" });
  }

  function handleMarkContacted() {
    startTransition(async () => {
      const res = await markContactedAction(r.devis_id, note, nextDate || null);
      if (res.ok) {
        toast.success(tf.outstandingMarked);
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
        toast.success(tf.outstandingTaskCreated);
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="bg-[#0D2D47] border border-[#22506F] rounded-xl p-4 mb-2 list-none">
      {/* Top row: client name + aging badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-medium text-[#F8FAFC] truncate">
            {r.client_id
              ? <Link href={`/dashboard/clients/${r.client_id}`} className="hover:text-brand">{r.client_name}</Link>
              : r.client_name}
          </span>
          {r.contacted && (
            <span className="shrink-0 rounded-full bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
              {tf.outstandingContacted}
            </span>
          )}
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px]", aging.cls)}>
          {aging.label}
        </span>
      </div>

      {/* Invoice + amount */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <Link href={`/dashboard/factures/${r.devis_id}`} className="text-[#64748B] text-xs hover:text-brand">
          {tf.outstandingColFacture} #{r.devis_number}
        </Link>
        <span className="text-[#22C55E] font-mono font-bold text-sm">
          {formatDt(r.outstanding_dt)}
        </span>
      </div>

      {/* Progress bar */}
      {r.paid_dt > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#22506F]">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
          </div>
          <span className="text-[10px] text-[#64748B]">{formatDt(r.paid_dt)} {tf.outstandingPaid}</span>
        </div>
      )}

      {/* Follow-up info */}
      {r.last_followup_at && (
        <p className="mt-1 text-[11px] text-[#64748B]">
          {tf.outstandingLastFollowup}{" "}
          {fmtFollowup(r.last_followup_at)}
          {r.next_followup_at && (
            <> {tf.outstandingNextFollowup}{" "}{fmtFollowup(r.next_followup_at)}</>
          )}
        </p>
      )}

      {/* Due date + action button */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-[#64748B]">
          {tf.outstandingDueLabel} {formatDate(r.due_date)}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
            open ? "bg-brand text-white" : "bg-brand/10 text-brand hover:bg-brand/20",
          )}
        >
          {open ? tc.close : tf.outstandingFollowup}
        </button>
      </div>

      {/* Expandable form */}
      {open && <FollowUpForm tf={tf} tc={tc} r={r} onMarkContacted={handleMarkContacted} onCreateTask={handleCreateTask} note={note} setNote={setNote} nextDate={nextDate} setNextDate={setNextDate} dark />}
    </li>
  );
}

function OutstandingTableRow({ row: r }: { row: OutstandingRow }) {
  const { t, locale } = useI18n();
  const tf = t.finance;
  const tc = t.common;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [, startTransition] = useTransition();
  const aging = agingBucket(tf, r.days_overdue);
  const paidPct = r.total_dt > 0 ? Math.min(100, (r.paid_dt / r.total_dt) * 100) : 0;

  function fmtFollowup(iso: string) {
    return new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "short" });
  }

  function handleMarkContacted() {
    startTransition(async () => {
      const res = await markContactedAction(r.devis_id, note, nextDate || null);
      if (res.ok) {
        toast.success(tf.outstandingMarked);
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
        toast.success(tf.outstandingTaskCreated);
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <tr className="hover:bg-[#123A5A]/50 transition-colors">
        {/* Client */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[#F8FAFC]">
              {r.client_id
                ? <Link href={`/dashboard/clients/${r.client_id}`} className="hover:text-brand">{r.client_name}</Link>
                : r.client_name}
            </span>
            {r.contacted && (
              <span className="rounded-full bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                {tf.outstandingContacted}
              </span>
            )}
          </div>
          {r.last_followup_at && (
            <p className="mt-0.5 text-[11px] text-[#64748B]">
              {tf.outstandingLastFollowup}{" "}
              {fmtFollowup(r.last_followup_at)}
              {r.next_followup_at && (
                <> {tf.outstandingFollowupNext} {fmtFollowup(r.next_followup_at)}</>
              )}
            </p>
          )}
        </td>

        <td className="py-3 px-4">
          <Link href={`/dashboard/factures/${r.devis_id}`} className="text-[#94A3B8] text-xs hover:text-brand">
            #{r.devis_number}
          </Link>
        </td>

        <td className="py-3 px-4 text-xs text-[#94A3B8]">
          {formatDate(r.due_date)}
        </td>

        <td className="py-3 px-4 text-right">
          <span className="font-mono font-bold text-[#22C55E]">{formatDt(r.outstanding_dt)}</span>
          {r.paid_dt > 0 && (
            <div className="mt-1 flex items-center justify-end gap-2">
              <div className="h-1 w-20 overflow-hidden rounded-full bg-[#22506F]">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
              </div>
              <span className="text-[10px] text-[#64748B]">{formatDt(r.paid_dt)} {tf.outstandingPaid}</span>
            </div>
          )}
        </td>

        <td className="py-3 px-4 text-center">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px]", aging.cls)}>
            {aging.label}
          </span>
        </td>

        <td className="py-3 px-4 text-center">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
              open ? "bg-brand text-white" : "bg-brand/10 text-brand hover:bg-brand/20",
            )}
          >
            {open ? tc.close : tf.outstandingFollowup}
          </button>
        </td>
      </tr>

      {open && (
        <tr className="bg-[#0D1117]">
          <td colSpan={6} className="px-4 pb-4 pt-2">
            <FollowUpForm tf={tf} tc={tc} r={r} onMarkContacted={handleMarkContacted} onCreateTask={handleCreateTask} note={note} setNote={setNote} nextDate={nextDate} setNextDate={setNextDate} />
          </td>
        </tr>
      )}
    </>
  );
}

function FollowUpForm({
  tf, tc, r, onMarkContacted, onCreateTask, note, setNote, nextDate, setNextDate, dark,
}: {
  tf: TF; tc: TC; r: OutstandingRow;
  onMarkContacted: () => void; onCreateTask: () => void;
  note: string; setNote: (v: string) => void;
  nextDate: string; setNextDate: (v: string) => void;
  dark?: boolean;
}) {
  const bg = dark ? "bg-[#0D1117]" : "bg-[#0D2D47]";
  const inputBg = dark ? "bg-[#0D2D47]" : "bg-[#0D1117]";
  const inputCls = `mt-1 w-full rounded-lg border border-[#22506F] ${inputBg} px-3 py-2 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20`;

  return (
    <div className={`mt-3 space-y-3 rounded-xl border border-[#22506F] ${bg} p-3.5`}>
      <div className="grid grid-cols-2 gap-2 max-w-md">
        <button type="button" onClick={onCreateTask}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
          {tf.outstandingCreateTask}
        </button>
        <Link href={`/dashboard/factures/${r.devis_id}`}
          className="flex items-center justify-center rounded-lg border border-[#22506F] bg-[#0D2D47] px-3 py-1.5 text-xs font-medium text-[#94A3B8] hover:border-brand/30 hover:text-brand">
          {tf.outstandingViewInvoice}
        </Link>
      </div>
      <div className="max-w-md">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">{tf.outstandingNoteLabel}</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={tf.outstandingNotePlaceholder} className={inputCls} />
      </div>
      <div className="flex items-end gap-2 max-w-md">
        <div className="flex-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">{tf.outstandingNextLabel}</label>
          <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className={inputCls} />
        </div>
        <button type="button" onClick={onMarkContacted}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
          {tf.outstandingMarkContacted}
        </button>
      </div>
    </div>
  );
}
