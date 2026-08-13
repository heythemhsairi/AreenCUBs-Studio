import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPayrollDt, type PayrollCalculation } from "@/lib/payroll";

export function PayrollSummaryCard({ calculation }: { calculation: PayrollCalculation }) {
  const tone = calculation.flag === "on_target" ? "green" : calculation.flag === "below" ? "amber" : "red";
  const label = calculation.flag === "on_target" ? "Objectif atteint" : calculation.flag === "below" ? "Sous l'objectif" : "Sous 80 %";
  return (
    <Card className="border-brand/30 bg-gradient-to-r from-brand/10 to-surface">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-brand/15 p-2.5 text-brand"><Trophy size={20} aria-hidden="true" /></span>
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-ink">Mes points ce mois</h2><Badge tone={tone}>{label}</Badge></div>
            <p className="mt-1 text-sm text-content-2"><strong className="text-ink">{calculation.points} points</strong> · {formatPayrollDt(calculation.earnedMillimes)} valorisés sur {formatPayrollDt(calculation.targetMillimes)}</p>
            <p className="mt-1 text-xs text-content-3">Paiement calculé aujourd&apos;hui : {formatPayrollDt(calculation.payoutMillimes)}</p>
          </div>
        </div>
        <Link href="/dashboard/payroll" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-brand hover:bg-brand/10">
          Voir le détail <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
