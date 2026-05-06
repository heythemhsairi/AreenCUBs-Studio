"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  setDevisStatusAction,
  recordPaymentAction,
  markFullyPaidAction,
  deleteDevisAction,
} from "../actions";
import { formatDt } from "@/lib/format";

type DevisStatus = "draft" | "sent" | "accepted" | "rejected";

export function DevisStatusActions({
  devisId,
  currentStatus,
}: {
  devisId: string;
  currentStatus: DevisStatus;
}) {
  const [pending, startTransition] = useTransition();

  function changeTo(s: DevisStatus) {
    startTransition(async () => {
      await setDevisStatusAction(devisId, s);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cycle de vie</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={currentStatus === "draft" ? "primary" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => changeTo("draft")}
          >
            Brouillon
          </Button>
          <Button
            variant={currentStatus === "sent" ? "primary" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => changeTo("sent")}
          >
            Envoyé
          </Button>
          <Button
            variant={currentStatus === "accepted" ? "primary" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => changeTo("accepted")}
          >
            Accepté
          </Button>
          <Button
            variant={currentStatus === "rejected" ? "primary" : "outline"}
            size="sm"
            disabled={pending}
            onClick={() => changeTo("rejected")}
          >
            Refusé
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaymentSection({
  devisId,
  totalDt,
  paidDt,
}: {
  devisId: string;
  totalDt: number;
  paidDt: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const [markPending, startMarkPaid] = useTransition();

  const remaining = +(totalDt - paidDt).toFixed(2);
  const pct = totalDt > 0 ? Math.min(100, (paidDt / totalDt) * 100) : 0;
  const isFullyPaid = remaining <= 0.01;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await recordPaymentAction(fd);
      if (!res.ok) setError(res.error);
      else {
        setDone(true);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  function onMarkFullyPaid() {
    if (!confirm("Marquer comme entièrement payé ? Un paiement du solde sera enregistré.")) return;
    const fd = new FormData();
    fd.set("devis_id", devisId);
    startMarkPaid(async () => {
      await markFullyPaidAction(fd);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paiement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink/60">
              Encaissé{" "}
              <span className="font-semibold text-ink">{formatDt(paidDt)}</span>{" "}
              / {formatDt(totalDt)}
            </span>
            <span
              className={
                isFullyPaid
                  ? "text-xs font-semibold uppercase text-green-600"
                  : remaining < totalDt
                    ? "text-xs font-semibold uppercase text-brand"
                    : "text-xs font-semibold uppercase text-accent-dark"
              }
            >
              {isFullyPaid
                ? "Payé"
                : remaining < totalDt
                  ? "Partiel"
                  : "Impayé"}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink/5">
            <div
              className="h-full bg-gradient-to-r from-brand to-brand-dark transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {!isFullyPaid && (
            <p className="text-xs text-ink/50">
              Reste à encaisser :{" "}
              <span className="font-semibold text-ink">
                {formatDt(remaining)}
              </span>
            </p>
          )}
        </div>

        {!isFullyPaid && (
          <div className="rounded-md bg-cream-dark/40 p-3">
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={onMarkFullyPaid}
              disabled={markPending}
              className="w-full"
            >
              {markPending
                ? "Enregistrement…"
                : `Marquer entièrement payé (${formatDt(remaining)})`}
            </Button>
          </div>
        )}

        <form className="space-y-3" onSubmit={onSubmit}>
          <input type="hidden" name="devis_id" value={devisId} />
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            ou enregistrer un paiement partiel
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Montant (DT)">
              <Input
                name="amount_dt"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder={remaining > 0 ? remaining.toFixed(2) : "0.00"}
              />
            </Field>
            <Field label="Date">
              <Input
                name="paid_at"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </Field>
            <Field label="Méthode">
              <Input name="method" placeholder="Virement, espèces…" />
            </Field>
            <Field label="Note">
              <Input name="notes" />
            </Field>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && (
            <p className="text-sm text-green-600">Paiement enregistré.</p>
          )}
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Enregistrement…" : "Ajouter le paiement"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DeleteDevisButton({
  devisId,
  kind,
}: {
  devisId: string;
  kind: "devis" | "facture";
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (
      !confirm(
        `Supprimer ${kind === "facture" ? "cette facture" : "ce devis"} ? Action irréversible.`,
      )
    )
      return;
    const fd = new FormData();
    fd.set("id", devisId);
    fd.set("kind", kind);
    startTransition(async () => {
      await deleteDevisAction(fd);
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-red-300 text-red-700 hover:bg-red-50"
      onClick={onDelete}
      disabled={pending}
    >
      {pending ? "…" : "Supprimer"}
    </Button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-ink/50">
        {label}
      </label>
      {children}
    </div>
  );
}
