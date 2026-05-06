"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  setDevisStatusAction,
  recordPaymentAction,
  deleteDevisAction,
} from "../actions";

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

export function RecordPaymentForm({
  devisId,
  remaining,
}: {
  devisId: string;
  remaining: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enregistrer un paiement</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onSubmit}>
          <input type="hidden" name="devis_id" value={devisId} />
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
            <Field label="Méthode (optionnel)">
              <Input name="method" placeholder="Virement, espèces, …" />
            </Field>
            <Field label="Note (optionnel)">
              <Input name="notes" />
            </Field>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {done && (
            <p className="text-sm text-green-600">Paiement enregistré.</p>
          )}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function DeleteDevisButton({ devisId }: { devisId: string }) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm("Supprimer ce devis ? Action irréversible.")) return;
    const fd = new FormData();
    fd.set("id", devisId);
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
      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
