"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
} from "@/components/ui/table";
import { formatDevisNumber, formatDt, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  setDevisStatusAction,
  markFullyPaidAction,
  resetPaymentsAction,
} from "@/app/dashboard/devis/actions";

type DevisStatus = "draft" | "sent" | "accepted" | "rejected";
type PaymentStatus = "unpaid" | "partial" | "paid";

const statusTone: Record<DevisStatus, "slate" | "blue" | "green" | "red"> = {
  draft: "slate",
  sent: "blue",
  accepted: "green",
  rejected: "red",
};

const paymentTone: Record<PaymentStatus, "amber" | "blue" | "green"> = {
  unpaid: "amber",
  partial: "blue",
  paid: "green",
};

const statusLabel: Record<DevisStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
};

const paymentLabel: Record<PaymentStatus, string> = {
  unpaid: "Impayé",
  partial: "Partiel",
  paid: "Payé",
};

const rowAccent: Record<PaymentStatus, string> = {
  paid: "before:bg-emerald-400",
  partial: "before:bg-brand",
  unpaid: "before:bg-accent",
};

type Row = {
  id: string;
  kind?: "devis" | "facture";
  devis_number: number;
  date: string;
  due_date: string;
  object: string | null;
  status: string;
  payment_status: string;
  total_dt: number;
  clients: { id: string; name: string } | { id: string; name: string }[] | null;
};

export function DevisListTable({
  rows,
  kind,
}: {
  rows: Row[];
  kind: "devis" | "facture";
}) {
  if (rows.length === 0) {
    return (
      <EmptyState>
        Aucun{kind === "facture" ? "e facture" : " devis"}. Créez le premier.
      </EmptyState>
    );
  }

  const baseUrl =
    kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";

  return (
    <>
      {/* Mobile cards — <md */}
      <div className="md:hidden space-y-3">
        {rows.map((d) => {
          const client = Array.isArray(d.clients) ? d.clients[0] : d.clients;
          const payStatus = d.payment_status as PaymentStatus;
          const devStatus = d.status as DevisStatus;
          return (
            <div key={d.id} className="rounded-xl border border-[#263244] bg-[#111827] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`${baseUrl}/${d.id}`}
                    className="font-mono text-xs text-[#22D3EE] hover:underline"
                  >
                    {formatDevisNumber(d.devis_number, kind)}
                  </Link>
                  <p className="mt-0.5 font-semibold text-[#F8FAFC] truncate">
                    {client?.name ?? "—"}
                  </p>
                </div>
                <p className="shrink-0 font-bold text-[#22C55E] text-sm">
                  {formatDt(d.total_dt)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusMenu devisId={d.id} current={devStatus} />
                <PaymentMenu devisId={d.id} current={payStatus} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[#64748B]">
                <span>{formatDate(d.date)}</span>
                <span>éch. {formatDate(d.due_date)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table — ≥md */}
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>N°</TH>
              <TH>Client</TH>
              <TH>Date</TH>
              <TH>Échéance</TH>
              <TH>Statut</TH>
              <TH>Paiement</TH>
              <TH className="text-right">Total TTC</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((d) => {
              const client = Array.isArray(d.clients) ? d.clients[0] : d.clients;
              const accent =
                rowAccent[d.payment_status as PaymentStatus] ?? "before:bg-ink/10";
              return (
                <tr
                  key={d.id}
                  className={cn(
                    "relative transition-colors duration-150 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r-full hover:bg-[#1E2A3A]",
                    accent,
                  )}
                >
                  <TD className="pl-5 font-mono text-xs text-[#64748B]">
                    <Link
                      href={`${baseUrl}/${d.id}`}
                      className="hover:text-[#22D3EE]"
                    >
                      {formatDevisNumber(d.devis_number, kind)}
                    </Link>
                  </TD>
                  <TD className="font-medium text-[#F8FAFC]">
                    {client?.name ?? "—"}
                  </TD>
                  <TD className="text-[#94A3B8]">{formatDate(d.date)}</TD>
                  <TD className="text-[#94A3B8]">{formatDate(d.due_date)}</TD>
                  <TD>
                    <StatusMenu
                      devisId={d.id}
                      current={d.status as DevisStatus}
                    />
                  </TD>
                  <TD>
                    <PaymentMenu
                      devisId={d.id}
                      current={d.payment_status as PaymentStatus}
                    />
                  </TD>
                  <TD className="text-right font-semibold text-[#F8FAFC]">
                    {formatDt(d.total_dt)}
                  </TD>
                </tr>
              );
            })}
          </TBody>
        </Table>
      </div>
    </>
  );
}

/* =========================================================================
 * Dropdown menus
 * ========================================================================= */

function StatusMenu({
  devisId,
  current,
}: {
  devisId: string;
  current: DevisStatus;
}) {
  const [pending, startTransition] = useTransition();

  function select(next: DevisStatus) {
    if (next === current) return;
    startTransition(async () => {
      await setDevisStatusAction(devisId, next);
    });
  }

  return (
    <Dropdown
      trigger={
        <ChipButton tone={statusTone[current]} dot disabled={pending}>
          {statusLabel[current]}
        </ChipButton>
      }
    >
      {(close) => (
        <>
          <MenuHeader>Changer le statut</MenuHeader>
          {(["draft", "sent", "accepted", "rejected"] as DevisStatus[]).map(
            (s) => (
              <MenuItem
                key={s}
                active={s === current}
                onClick={() => {
                  close();
                  select(s);
                }}
              >
                <DotSwatch tone={statusTone[s]} />
                {statusLabel[s]}
              </MenuItem>
            ),
          )}
        </>
      )}
    </Dropdown>
  );
}

function PaymentMenu({
  devisId,
  current,
}: {
  devisId: string;
  current: PaymentStatus;
}) {
  const [pending, startTransition] = useTransition();

  function markPaid() {
    if (current === "paid") return;
    const fd = new FormData();
    fd.set("devis_id", devisId);
    startTransition(async () => {
      await markFullyPaidAction(fd);
    });
  }

  function resetPayments() {
    if (current === "unpaid") return;
    if (!confirm("Annuler tous les paiements enregistrés ?")) return;
    startTransition(async () => {
      await resetPaymentsAction(devisId);
    });
  }

  return (
    <Dropdown
      trigger={
        <ChipButton tone={paymentTone[current]} dot disabled={pending}>
          {paymentLabel[current]}
        </ChipButton>
      }
    >
      {(close) => (
        <>
          <MenuHeader>Paiement</MenuHeader>
          <MenuItem
            disabled={current === "paid"}
            onClick={() => {
              close();
              markPaid();
            }}
          >
            <DotSwatch tone="green" />
            Marquer payé
          </MenuItem>
          <MenuItem
            disabled={current === "unpaid"}
            onClick={() => {
              close();
              resetPayments();
            }}
          >
            <DotSwatch tone="amber" />
            Annuler les paiements
          </MenuItem>
          <div className="my-1 h-px bg-[#263244]" />
          <MenuItem asLink href={`/dashboard/devis/${devisId}`}>
            <span className="text-[#64748B]">Détails &amp; partiel →</span>
          </MenuItem>
        </>
      )}
    </Dropdown>
  );
}

/* =========================================================================
 * Reusable dropdown primitives (local to this file)
 * ========================================================================= */

function Dropdown({
  trigger,
  children,
}: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const MENU_WIDTH = 200;
  const MARGIN = 8;

  function compute() {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    // Use viewport-relative (fixed) coords so we never get clipped by an
    // overflow ancestor (e.g. the table wrapper).
    let left = r.left;
    if (left + MENU_WIDTH > window.innerWidth - MARGIN) {
      // Flip: right-align to the trigger so the menu opens to the left.
      left = r.right - MENU_WIDTH;
    }
    setPos({ top: r.bottom + 6, left: Math.max(MARGIN, left) });
  }

  // Position before paint to avoid a flash
  useLayoutEffect(() => {
    if (open) compute();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScrollOrResize() {
      compute();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex cursor-pointer items-center"
      >
        {trigger}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              minWidth: MENU_WIDTH,
            }}
            className="z-[100] rounded-xl border border-[#263244] bg-[#111827] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            role="menu"
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}

function MenuHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
      {children}
    </p>
  );
}

function MenuItem({
  children,
  onClick,
  active,
  disabled,
  asLink,
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  asLink?: boolean;
  href?: string;
}) {
  const cls = cn(
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
    disabled
      ? "cursor-not-allowed text-[#3F4C59]"
      : "text-[#94A3B8] hover:bg-[#1E2A3A] hover:text-[#F8FAFC]",
    active && "bg-[#22D3EE]/10 text-[#22D3EE]",
  );

  if (asLink && href) {
    return (
      <Link href={href} className={cls} role="menuitem">
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cls}
    >
      {children}
    </button>
  );
}

function ChipButton({
  tone,
  dot,
  disabled,
  children,
}: {
  tone: "slate" | "blue" | "green" | "amber" | "red";
  dot?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Badge
      tone={tone}
      dot={dot}
      className={cn(
        "select-none cursor-pointer transition-all hover:shadow-soft hover:scale-[1.02]",
        disabled && "opacity-60",
      )}
    >
      {children}
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-0.5 opacity-70"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </Badge>
  );
}

function DotSwatch({
  tone,
}: {
  tone: "slate" | "blue" | "green" | "amber" | "red";
}) {
  const color =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "blue"
        ? "bg-brand"
        : tone === "amber"
          ? "bg-accent"
          : tone === "red"
            ? "bg-red-500"
            : "bg-ink/40";
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", color)} />;
}
