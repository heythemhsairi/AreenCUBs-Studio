import Link from "next/link";
import { CalendarClock, CheckCircle2, CircleDollarSign, Gauge, History, Trophy } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { formatPayrollDt, type PayrollCalculation } from "@/lib/payroll";

type HistoryRow = {
  id: string;
  period_start: string;
  earned_millimes: number;
  payout_millimes: number;
  target_millimes: number;
  output_points: number;
  status: string;
  paid_at: string | null;
};

export function WorkerPayroll({
  workerName,
  periodStart,
  calculation,
  workingDays,
  history,
}: {
  workerName: string;
  periodStart: string;
  calculation: PayrollCalculation | null;
  workingDays: number;
  history: HistoryRow[];
}) {
  if (!calculation) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mes points & salaire" description="Suivi mensuel lié aux tâches terminées." />
        <Card><CardContent className="p-6"><EmptyState icon={<Gauge />} title="Suivi non activé" description="Votre administrateur doit définir votre objectif mensuel." /></CardContent></Card>
      </div>
    );
  }
  const progress = Math.min(100, calculation.progressPercent);
  const dailyPace = calculation.targetMillimes / workingDays;
  const flag = flagPresentation(calculation.flag);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes points & salaire"
        description={`${workerName} · mois démarré le ${formatDate(periodStart)}`}
      />

      <Card className="overflow-hidden border-brand/30 bg-gradient-to-br from-brand/10 to-surface">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-content-2">Travail valorisé ce mois</p>
              <p className="mt-1 text-3xl font-semibold text-ink">{formatPayrollDt(calculation.earnedMillimes)}</p>
            </div>
            <Badge tone={flag.tone} className="px-3 py-1">{flag.label}</Badge>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs text-content-2">
              <span>{calculation.progressPercent.toFixed(1)} % de l&apos;objectif</span>
              <span>{formatPayrollDt(calculation.targetMillimes)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-3" aria-label={`${calculation.progressPercent.toFixed(1)} % de l'objectif`}>
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <p className="text-sm text-content-2">
            {calculation.flag === "on_target"
              ? `Paiement calculé : ${formatPayrollDt(calculation.payoutMillimes)}.`
              : `Il manque ${formatPayrollDt(calculation.shortfallMillimes)}. En dessous de l'objectif, le paiement du mois reste à 0 DT.`}
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs du mois">
        <Metric icon={<Trophy />} label="Points de production" value={String(calculation.points)} detail="volume, sans valeur monétaire" />
        <Metric icon={<CircleDollarSign />} label="Paiement calculé" value={formatPayrollDt(calculation.payoutMillimes)} detail="selon la règle du seuil" />
        <Metric icon={<CalendarClock />} label="Rythme moyen" value={formatPayrollDt(dailyPace)} detail={`${workingDays} jours ouvrés ce mois`} />
        <Metric icon={<Gauge />} label="Ligne rouge" value={formatPayrollDt(calculation.baselineMillimes)} detail="80 % de l'objectif" />
      </section>

      <Card>
        <CardHeader><CardTitle>Tâches et bonus comptabilisés</CardTitle></CardHeader>
        <CardContent>
          {calculation.breakdown.length === 0 ? (
            <EmptyState icon={<CheckCircle2 />} title="Aucun point ce mois" description="Une tâche classée par l'administrateur apparaît ici lorsqu'elle est terminée." size="sm" />
          ) : (
            <ul className="divide-y divide-line">
              {calculation.breakdown.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{entry.label}</p>
                    <p className="text-xs text-content-3">{formatDate(entry.occurredAt)} · {entry.points} point{entry.points === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-ink">{formatPayrollDt(entry.baseMillimes)}</span>
                    {entry.taskId && <Link href={`/dashboard/tasks/${entry.taskId}`} className="text-xs font-semibold text-brand hover:underline">Voir la tâche</Link>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><History size={18} /> Historique des paiements</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState icon={<History />} title="Aucun paiement enregistré" description="Les mois clôturés par l'administration apparaîtront ici." size="sm" />
          ) : (
            <ul className="divide-y divide-line">
              {history.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-4 py-3">
                  <div><p className="text-sm font-medium text-ink">{monthName(payment.period_start)}</p><p className="text-xs text-content-3">{payment.output_points} points · {formatPayrollDt(payment.earned_millimes)} valorisés</p></div>
                  <div className="text-right"><p className="text-sm font-semibold text-ink">{formatPayrollDt(payment.payout_millimes)}</p><Badge tone={payment.status === "paid" ? "green" : "amber"}>{payment.status === "paid" ? "Payé" : "Calculé"}</Badge></div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <Card><CardContent className="p-4"><div className="mb-3 text-brand">{icon}</div><p className="text-xs text-content-3">{label}</p><p className="mt-1 text-xl font-semibold text-ink">{value}</p><p className="mt-1 text-xs text-content-3">{detail}</p></CardContent></Card>;
}

function flagPresentation(flag: PayrollCalculation["flag"]): { label: string; tone: "red" | "amber" | "green" } {
  if (flag === "on_target") return { label: "Objectif atteint", tone: "green" };
  if (flag === "below") return { label: "Sous l'objectif", tone: "amber" };
  return { label: "Risque · sous 80 %", tone: "red" };
}

function monthName(periodStart: string) {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Tunis" }).format(new Date(`${periodStart}T12:00:00+01:00`));
}
