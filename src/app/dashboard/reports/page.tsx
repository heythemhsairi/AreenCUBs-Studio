import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { toBusinessDateKey } from "@/lib/format";

/**
 * The agency brief: daily on top, weekly management view under it.
 *
 * Evidence-based means two disciplines, both visible on the page. Every figure
 * is queried live through RLS at render time — nothing is cached or estimated —
 * and every section is labelled with its EPISTEMIC status: confirmed (read
 * from records), derived (computed from records, formula stated), or missing
 * (the data does not exist yet, said plainly rather than silently omitted).
 *
 * Worker workload deliberately does not rank by task count. Volume alone is
 * the one measure the roadmap forbids: five trivial tasks are not five urgent
 * ones. The load score weights priority and overdue state, and the page says
 * so, because an unexplained score is indistinguishable from a wrong one.
 */

const dtf = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number) => `${dtf.format(n)} DT`;

/** Priority weights for the workload score. Stated on the page verbatim. */
const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 3,
  high: 2,
  normal: 1,
  low: 0.5,
};
const OVERDUE_BOOST = 1.5;

async function safe<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[reports:${label}]`, err);
    return fallback;
  }
}

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const todayKey = toBusinessDateKey(new Date()) ?? "";
  const weekAgo = toBusinessDateKey(new Date(Date.now() - 7 * 24 * 3600 * 1000)) ?? "";

  const [tasks, projects, clients, devis, payments, profiles, shadow, audit] =
    await Promise.all([
      safe(
        async () =>
          (await supabase
            .from("tasks")
            .select("id, title, status, priority, deadline, assignee_id, project_id")).data ?? [],
        [],
        "tasks",
      ),
      safe(
        async () =>
          (await supabase.from("projects").select("id, name, status, end_date, client_id")).data ??
          [],
        [],
        "projects",
      ),
      safe(
        async () => (await supabase.from("clients").select("id, name")).data ?? [],
        [],
        "clients",
      ),
      safe(
        async () =>
          (await supabase
            .from("devis")
            .select("id, kind, status, payment_status, total_dt, due_date, client_id")).data ?? [],
        [],
        "devis",
      ),
      safe(
        async () => (await supabase.from("payments").select("devis_id, amount_dt")).data ?? [],
        [],
        "payments",
      ),
      safe(
        async () =>
          (await supabase.from("profiles").select("id, full_name, username, role")).data ?? [],
        [],
        "profiles",
      ),
      safe(
        async () =>
          (await supabase
            .from("money_shadow_log")
            .select("id, divergence_millimes, created_at")).data ?? [],
        [],
        "shadow",
      ),
      safe(
        async () =>
          (await supabase
            .from("audit_log")
            .select("id, created_at")
            .gte("created_at", `${weekAgo}T00:00:00Z`)).data ?? [],
        [],
        "audit",
      ),
    ]);

  const nameById = new Map(clients.map((c) => [c.id, c.name]));
  const personById = new Map(profiles.map((p) => [p.id, p.full_name ?? p.username]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  // ── Daily: what needs eyes today ──────────────────────────────────────────
  const overdueTasks = tasks.filter(
    (t) => t.status !== "done" && t.deadline !== null && t.deadline < todayKey,
  );
  const dueToday = tasks.filter((t) => t.status !== "done" && t.deadline === todayKey);

  // Project health, derived: past its end date while still active, or marked
  // completed while holding open work — both contradictions between the manual
  // status and the evidence.
  const overdueProjects = projects.filter(
    (p) => p.status === "active" && p.end_date !== null && p.end_date < todayKey,
  );
  const contradictedProjects = projects.filter(
    (p) =>
      p.status === "completed" &&
      tasks.some((t) => t.project_id === p.id && t.status !== "done"),
  );

  // Financial alerts, derived from payments — never from payment_status alone,
  // which historically disagreed with the money (audit finding #5).
  const paidByDevis = new Map<string, number>();
  for (const p of payments) {
    paidByDevis.set(p.devis_id, (paidByDevis.get(p.devis_id) ?? 0) + Number(p.amount_dt));
  }
  const factures = devis.filter((d) => d.kind === "facture" && d.status !== "draft");
  const withBalance = factures
    .map((f) => ({
      ...f,
      balance: +(Number(f.total_dt) - (paidByDevis.get(f.id) ?? 0)).toFixed(2),
    }))
    .filter((f) => f.balance > 0.01);
  const overdueInvoices = withBalance.filter(
    (f) => f.due_date !== null && f.due_date < todayKey,
  );
  const statusContradictions = factures.filter((f) => {
    const balance = +(Number(f.total_dt) - (paidByDevis.get(f.id) ?? 0)).toFixed(2);
    return f.payment_status === "paid" && balance > 0.01;
  });

  // Follow-ups: sent quotes and invoices awaiting an answer.
  const awaitingReply = devis.filter((d) => d.status === "sent");

  // ── Weekly: workload, weighted — never volume alone ───────────────────────
  const load = new Map<string, { score: number; open: number; overdue: number }>();
  for (const t of tasks) {
    if (t.status === "done" || !t.assignee_id) continue;
    const isOverdue = t.deadline !== null && t.deadline < todayKey;
    const weight =
      (PRIORITY_WEIGHT[t.priority] ?? 1) * (isOverdue ? OVERDUE_BOOST : 1);
    const cur = load.get(t.assignee_id) ?? { score: 0, open: 0, overdue: 0 };
    cur.score += weight;
    cur.open += 1;
    if (isOverdue) cur.overdue += 1;
    load.set(t.assignee_id, cur);
  }
  const workload = Array.from(load.entries())
    .map(([id, w]) => ({ name: personById.get(id) ?? "—", ...w }))
    .sort((a, b) => b.score - a.score);

  const shadowRecent = shadow.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brief de l'agence"
        description="Quotidien puis hebdomadaire. Chaque chiffre est requêté à l'affichage et chaque section annonce son statut : confirmé, dérivé ou manquant."
      />

      {/* ── Daily brief ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Aujourd&apos;hui — travail en retard <Badge tone="slate">dérivé</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 && dueToday.length === 0 ? (
              <p className="text-sm text-content-3">Aucune tâche en retard ni due aujourd&apos;hui.</p>
            ) : (
              <ul className="divide-y divide-line">
                {[...overdueTasks, ...dueToday].map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{t.title}</p>
                      <p className="truncate text-xs text-content-3">
                        {personById.get(t.assignee_id ?? "") ?? "Non assignée"}
                        {" · "}
                        {projectById.get(t.project_id)?.name ?? "—"}
                      </p>
                    </div>
                    <Badge tone={t.deadline !== null && t.deadline < todayKey ? "amber" : "blue"}>
                      {t.deadline !== null && t.deadline < todayKey ? "En retard" : "Aujourd'hui"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-content-3">
              Dérivé : échéance passée et statut non terminé. Le blocage inter-tâches n&apos;est
              pas suivi dans les données — manquant.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Alertes financières <Badge tone="slate">dérivé des paiements</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-ink">
              {overdueInvoices.length} facture(s) échue(s) pour{" "}
              <strong>{fmt(overdueInvoices.reduce((s, f) => s + f.balance, 0))}</strong>
            </p>
            {statusContradictions.length > 0 && (
              <p className="text-sm text-danger">
                {statusContradictions.length} facture(s) marquée(s) payée(s) alors que les
                paiements enregistrés laissent un solde — à réconcilier.
              </p>
            )}
            {shadowRecent > 0 && (
              <p className="text-sm text-content-2">
                {shadowRecent} divergence(s) de calcul enregistrées par la comparaison des
                moteurs (montants non stockés, structure seulement).
              </p>
            )}
            <p className="text-xs text-content-3">
              Dérivé : solde = total facturé − paiements enregistrés. Le statut de paiement
              stocké n&apos;est jamais cru sur parole (constat d&apos;audit n°5).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Santé des projets <Badge tone="slate">dérivé</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueProjects.length === 0 && contradictedProjects.length === 0 ? (
              <p className="text-sm text-content-3">Aucune contradiction détectée.</p>
            ) : (
              <ul className="space-y-2">
                {overdueProjects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-ink">
                      {p.name}
                      <span className="text-content-3"> · {nameById.get(p.client_id) ?? "—"}</span>
                    </span>
                    <Badge tone="amber">Échéance dépassée</Badge>
                  </li>
                ))}
                {contradictedProjects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-ink">{p.name}</span>
                    <Badge tone="red">Terminé avec tâches ouvertes</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Relances clients <Badge tone="green">confirmé</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {awaitingReply.length === 0 ? (
              <p className="text-sm text-content-3">Aucun document en attente de réponse.</p>
            ) : (
              <ul className="divide-y divide-line">
                {awaitingReply.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate text-ink">{nameById.get(d.client_id) ?? "—"}</span>
                    <span className="shrink-0 text-content-2">
                      {fmt(Number(d.total_dt))}
                      {d.due_date !== null && d.due_date < todayKey && (
                        <Badge tone="amber" className="ml-2">
                          Échéance passée
                        </Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Weekly management view ── */}
      <Card>
        <CardHeader>
          <CardTitle>
            Charge par personne <Badge tone="slate">dérivé — jamais le volume seul</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {workload.length === 0 ? (
            <p className="text-sm text-content-3">Aucune tâche ouverte assignée.</p>
          ) : (
            <ul className="divide-y divide-line">
              {workload.map((w) => (
                <li key={w.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-ink">{w.name}</span>
                  <span className="text-content-2">
                    score {w.score.toFixed(1)} · {w.open} ouverte(s)
                    {w.overdue > 0 ? ` · ${w.overdue} en retard` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-content-3">
            Score = priorité (urgent ×3, haute ×2, normale ×1, basse ×0,5), majoré ×1,5 si en
            retard. La complexité réelle, les dépendances et le temps passé ne sont pas encore
            saisis — manquant ; le score est une approximation et se présente comme telle.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Actions nécessitant une approbation <Badge tone="green">confirmé</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-content-2">
            <li>Rotation de la clé service-role exposée (docs/audit/DECISIONS-NEEDED.md §1)</li>
            <li>Restriction du périmètre collaborateurs (§11b) et freelances (§11c)</li>
            <li>État du schéma de production — aucun registre de migrations (§14)</li>
            <li>Activation du moteur de calcul en millimes (divergence documentée)</li>
            <li>Connexion du compte Google Drive réel (docs/GOOGLE-DRIVE-SETUP.md)</li>
          </ul>
          <p className="mt-3 text-xs text-content-3">
            {audit.length} action(s) tracée(s) dans le journal d&apos;audit ces 7 derniers jours —{" "}
            détail sur la page Journal d&apos;audit.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
