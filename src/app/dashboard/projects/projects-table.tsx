"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui/table";
import { toast } from "@/components/toast";
import { updateProjectStatusAction } from "./actions";

type Status = "active" | "on_hold" | "completed" | "cancelled";

const statusTone: Record<Status, "blue" | "amber" | "green" | "slate"> = {
  active: "blue",
  on_hold: "amber",
  completed: "green",
  cancelled: "slate",
};

const ALL_STATUSES: Status[] = ["active", "on_hold", "completed", "cancelled"];

export type ProjectRow = {
  id: string;
  name: string;
  status: Status;
  end_date: string | null;
  owner: string;
  tasks_count: number;
  client?: { id: string; name: string };
};

function StatusCell({
  projectId,
  initial,
  isAdmin,
}: {
  projectId: string;
  initial: Status;
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>(initial);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!isAdmin) {
    return <Badge tone={statusTone[status]}>{t.projects.status[status]}</Badge>;
  }

  function handleSelect(next: Status) {
    setOpen(false);
    if (next === status) return;
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const result = await updateProjectStatusAction(projectId, next);
      if (!result.ok) {
        setStatus(prev);
        toast.error(result.error);
      } else {
        toast.success(t.common.saved);
      }
    });
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full transition-opacity disabled:opacity-60"
        aria-label={t.projects.columns.status}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Badge tone={statusTone[status]}>{t.projects.status[status]}</Badge>
        {isPending ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--c-border)] border-t-[#22D3EE]" />
        ) : (
          <ChevronDown
            size={11}
            className={`text-[var(--c-text-3)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t.projects.columns.status}
          className="absolute left-0 top-full z-50 mt-1.5 min-w-[130px] rounded-xl border border-[var(--c-border)] bg-[var(--c-card)] py-1 shadow-2xl shadow-black/40"
        >
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              role="option"
              aria-selected={s === status}
              type="button"
              onClick={() => handleSelect(s)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--c-elevated)]"
            >
              <Badge tone={statusTone[s]}>{t.projects.status[s]}</Badge>
              {s === status && <Check size={11} className="text-[#22D3EE] shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectsTable({
  projects,
  showClient,
  isAdmin,
}: {
  projects: ProjectRow[];
  showClient?: boolean;
  isAdmin?: boolean;
}) {
  const { t } = useI18n();

  if (projects.length === 0) {
    return <EmptyState>{t.projects.empty}</EmptyState>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>{t.projects.columns.name}</TH>
          {showClient && <TH>Client</TH>}
          <TH>{t.projects.columns.status}</TH>
          <TH>{t.projects.columns.owner}</TH>
          <TH>{t.projects.columns.deadline}</TH>
          <TH>{t.projects.columns.tasks}</TH>
        </TR>
      </THead>
      <TBody>
        {projects.map((p) => (
          <TR key={p.id}>
            <TD className="font-medium text-[#F4FAFF]">
              <Link
                href={`/dashboard/projects/${p.id}`}
                className="hover:text-[#22D3EE]"
              >
                {p.name}
              </Link>
            </TD>
            {showClient && (
              <TD className="text-[#B8D0E4]">
                {p.client ? (
                  <Link
                    href={`/dashboard/clients/${p.client.id}`}
                    className="hover:text-[#22D3EE]"
                  >
                    {p.client.name}
                  </Link>
                ) : (
                  "—"
                )}
              </TD>
            )}
            <TD>
              <StatusCell
                projectId={p.id}
                initial={p.status}
                isAdmin={isAdmin ?? false}
              />
            </TD>
            <TD className="text-[#B8D0E4]">{p.owner}</TD>
            <TD className="text-[#B8D0E4]">
              {p.end_date
                ? new Date(p.end_date).toLocaleDateString()
                : "—"}
            </TD>
            <TD className="text-[#B8D0E4]">{p.tasks_count}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
