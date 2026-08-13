"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Gift, Plus, Settings2, Trash2, UsersRound, X } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { formatPayrollDt, type PayrollCalculation } from "@/lib/payroll";
import {
  addPayrollBonusAction,
  createPayrollTaskTypeAction,
  deletePayrollTaskTypeAction,
  deletePayrollBonusAction,
  savePayrollPaymentAction,
  savePayrollTaskTypeAction,
  saveWorkerPayrollAction,
} from "./actions";

export type AdminPayrollWorker = {
  id: string;
  username: string;
  full_name: string | null;
  setting: { user_id: string; target_millimes: number; baseline_percent: number; active: boolean } | null;
  calculation: PayrollCalculation | null;
  previousCalculation: PayrollCalculation | null;
};

type TaskType = { id: string; code: string; label: string; base_rate_millimes: number; above_rate_millimes: number; output_points: number; active: boolean };
type Bonus = { id: string; user_id: string; bonus_date: string; amount_millimes: number; reason: string };
type Payment = { id: string; user_id: string; period_start: string; payout_millimes: number; status: string; paid_at: string | null };
type ActionResult = { ok: true } | { ok: false; error: string };

export function AdminPayrollClient({ today, previousPeriodStart, workers, taskTypes, bonuses, payments }: {
  today: string;
  previousPeriodStart: string;
  workers: AdminPayrollWorker[];
  taskTypes: TaskType[];
  bonuses: Bonus[];
  payments: Payment[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [addingTaskType, setAddingTaskType] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: (formData: FormData) => Promise<ActionResult>, formData: FormData, onSuccess?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setMessage("Modifications enregistrées.");
        onSuccess?.();
        router.refresh();
      } else {
        setMessage(result.error);
      }
    });
  }

  function deleteTaskType(id: string, label: string) {
    if (!window.confirm(`Supprimer définitivement « ${label} » ?`)) return;
    const formData = new FormData();
    formData.set("id", id);
    run(deletePayrollTaskTypeAction, formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Points & salaires" description="Tarifs, objectifs, bonus et clôtures mensuelles des collaborateurs." />
      <div className="rounded-xl border border-info/30 bg-info/10 p-4 text-sm text-content-2">
        Ce module calcule et enregistre les montants internes. « Payé » confirme un règlement effectué; aucun virement bancaire n&apos;est envoyé automatiquement.
      </div>
      {message && <p role="status" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">{message}</p>}

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Vue mensuelle">
        {workers.map((worker) => {
          const calc = worker.calculation;
          const payment = payments.find((p) => p.user_id === worker.id && p.period_start === previousPeriodStart);
          return (
            <Card key={worker.id}>
              <CardHeader><CardTitle className="flex items-center justify-between gap-3"><span className="truncate">{worker.full_name ?? worker.username}</span><Badge tone={calc?.flag === "on_target" ? "green" : calc?.flag === "below" ? "amber" : "red"}>{calc ? `${calc.progressPercent.toFixed(0)} %` : "Inactif"}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Stat label="Valorisé" value={calc ? formatPayrollDt(calc.earnedMillimes) : "—"} />
                  <Stat label="Paiement" value={calc ? formatPayrollDt(calc.payoutMillimes) : "—"} />
                  <Stat label="Points" value={calc ? String(calc.points) : "—"} />
                  <Stat label="Objectif" value={calc ? formatPayrollDt(calc.targetMillimes) : "—"} />
                </div>
                {worker.previousCalculation && (
                  <form action={(fd) => run(savePayrollPaymentAction, fd)} className="space-y-2">
                    <input type="hidden" name="user_id" value={worker.id} />
                    <input type="hidden" name="period_start" value={previousPeriodStart} />
                    <input type="hidden" name="status" value="paid" />
                    <Input name="note" placeholder="Note de règlement (optionnel)" />
                    <Button type="submit" className="w-full" disabled={pending} variant={payment?.status === "paid" ? "outline" : "primary"}>
                      <Banknote size={16} /> {payment?.status === "paid" ? "Recalculer le mois précédent" : `Payer le mois précédent · ${formatPayrollDt(worker.previousCalculation.payoutMillimes)}`}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound size={18} /> Objectifs des collaborateurs</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {workers.map((worker) => (
            <form key={worker.id} action={(fd) => run(saveWorkerPayrollAction, fd)} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-3">
              <input type="hidden" name="user_id" value={worker.id} />
              <div className="sm:col-span-3"><p className="font-medium text-ink">{worker.full_name ?? worker.username}</p><p className="text-xs text-content-3">@{worker.username}</p></div>
              <Field label="Objectif mensuel (DT)"><Input name="target_dt" type="number" min="1" step="0.001" required defaultValue={worker.setting ? worker.setting.target_millimes / 1000 : ""} /></Field>
              <Field label="Ligne rouge (%)"><Input name="baseline_percent" type="number" min="1" max="99" required defaultValue={worker.setting?.baseline_percent ?? 80} /></Field>
              <label className="flex min-h-11 items-center gap-2 self-end text-sm text-ink"><input name="active" type="checkbox" defaultChecked={worker.setting?.active ?? true} /> Activé</label>
              <Button type="submit" disabled={pending} className="sm:col-span-3">Enregistrer l&apos;objectif</Button>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><Settings2 size={18} /> Tarifs et points par type de tâche</CardTitle>
          <Button type="button" size="sm" variant={addingTaskType ? "ghost" : "outline"} onClick={() => setAddingTaskType((open) => !open)} disabled={pending}>
            {addingTaskType ? <X size={16} /> : <Plus size={16} />} {addingTaskType ? "Annuler" : "Ajouter un type"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {addingTaskType ? (
            <form action={(fd) => run(createPayrollTaskTypeAction, fd, () => setAddingTaskType(false))} className="grid gap-3 rounded-xl border border-info/40 bg-info/5 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
              <div className="sm:col-span-2 lg:col-span-6">
                <p className="font-medium text-ink">Nouveau type de tâche</p>
                <p className="text-xs text-content-3">Il sera immédiatement disponible dans les tâches et actif par défaut.</p>
              </div>
              <Field label="Type"><Input name="label" required autoFocus /></Field>
              <Field label="Tarif de base (DT)"><Input name="base_rate_dt" type="number" min="0.001" step="0.001" required /></Field>
              <Field label="Au-dessus du seuil (DT)"><Input name="above_rate_dt" type="number" min="0.001" step="0.001" required /></Field>
              <Field label="Points"><Input name="output_points" type="number" min="0" step="1" required /></Field>
              <Button type="submit" disabled={pending} className="sm:col-span-2 lg:col-span-2"><Plus size={16} /> Créer le type</Button>
            </form>
          ) : null}
          {taskTypes.map((type) => (
            <form key={type.id} action={(fd) => run(savePayrollTaskTypeAction, fd)} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
              <input type="hidden" name="id" value={type.id} />
              <Field label="Type"><Input name="label" required defaultValue={type.label} /></Field>
              <Field label="Tarif de base (DT)"><Input name="base_rate_dt" type="number" min="0.001" step="0.001" required defaultValue={type.base_rate_millimes / 1000} /></Field>
              <Field label="Au-dessus du seuil (DT)"><Input name="above_rate_dt" type="number" min="0.001" step="0.001" required defaultValue={type.above_rate_millimes / 1000} /></Field>
              <Field label="Points"><Input name="output_points" type="number" min="0" step="1" required defaultValue={type.output_points} /></Field>
              <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input name="active" type="checkbox" defaultChecked={type.active} /> Actif</label>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
                <Button type="submit" disabled={pending} className="flex-1">Enregistrer</Button>
                <Button type="button" variant="ghost" size="sm" className="h-9 w-9 shrink-0 px-0" disabled={pending} aria-label={`Supprimer ${type.label}`} onClick={() => deleteTaskType(type.id, type.label)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Gift size={18} /> Bonus manager</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <form action={(fd) => run(addPayrollBonusAction, fd)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <Field label="Collaborateur"><Select name="user_id" required><option value="">Choisir…</option>{workers.map((w) => <option key={w.id} value={w.id}>{w.full_name ?? w.username}</option>)}</Select></Field>
            <Field label="Date"><Input name="bonus_date" type="date" required defaultValue={today} /></Field>
            <Field label="Montant (DT)"><Input name="amount_dt" type="number" min="0.001" step="0.001" required /></Field>
            <Field label="Raison écrite"><Input name="reason" minLength={3} maxLength={500} required /></Field>
            <Button type="submit" disabled={pending}>Ajouter le bonus</Button>
          </form>
          <ul className="divide-y divide-line">
            {bonuses.map((bonus) => {
              const worker = workers.find((w) => w.id === bonus.user_id);
              return <li key={bonus.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-ink">{worker?.full_name ?? worker?.username ?? "Collaborateur"} · {formatPayrollDt(bonus.amount_millimes)}</p><p className="text-xs text-content-3">{formatDate(bonus.bonus_date)} · {bonus.reason}</p></div><form action={(fd) => run(deletePayrollBonusAction, fd)}><input type="hidden" name="id" value={bonus.id} /><Button type="submit" variant="ghost" size="sm" disabled={pending}>Supprimer</Button></form></li>;
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5"><span className="block text-xs font-medium text-content-2">{label}</span>{children}</label>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-content-3">{label}</p><p className="font-semibold text-ink">{value}</p></div>;
}
