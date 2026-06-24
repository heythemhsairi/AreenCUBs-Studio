"use client";

import { useState, useTransition, useRef } from "react";
import { cn } from "@/lib/utils";
import { formatDt, formatDate } from "@/lib/format";
import { toast } from "@/components/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addExpenseAction, deleteExpenseAction, EXPENSE_CATEGORIES } from "./expense-actions";

export type ExpenseRow = {
  id: string;
  title: string;
  category: string;
  amount_dt: number;
  expense_date: string;
  project_id: string | null;
  client_id: string | null;
  vendor: string | null;
  payment_method: string | null;
  notes: string | null;
  project_name: string | null;
  client_name: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  salaries: "Salaires", freelancers: "Freelances", ads: "Publicité",
  software: "Logiciels", hosting: "Hébergement", transport: "Transport",
  office: "Bureau", production: "Production client", other: "Autre",
};

const CATEGORY_COLORS: Record<string, string> = {
  salaries: "bg-violet-100 text-violet-700",
  freelancers: "bg-blue-100 text-blue-700",
  ads: "bg-pink-100 text-pink-700",
  software: "bg-cyan-100 text-cyan-700",
  hosting: "bg-teal-100 text-teal-700",
  transport: "bg-orange-100 text-orange-700",
  office: "bg-amber-100 text-amber-700",
  production: "bg-brand/10 text-brand-dark",
  other: "bg-ink/8 text-ink/55",
};

export function ExpensesTab({
  rows, projects, clients, expByCategory, mtdExpenses,
}: {
  rows: ExpenseRow[];
  projects: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  expByCategory: Record<string, number>;
  mtdExpenses: number;
}) {
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const totalAll = rows.reduce((s, e) => s + e.amount_dt, 0);

  const filtered = filterCat === "all" ? rows : rows.filter((e) => e.category === filterCat);

  function handleAdd(formData: FormData) {
    startTransition(async () => {
      const res = await addExpenseAction(formData);
      if (res.ok) {
        toast.success("Dépense ajoutée");
        setShowForm(false);
        formRef.current?.reset();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer cette dépense ?")) return;
    startTransition(async () => {
      const res = await deleteExpenseAction(id);
      if (res.ok) toast.success("Dépense supprimée");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Dépenses (mois)" value={mtdExpenses} color="text-red-600" />
        <StatTile label="Total dépenses" value={totalAll} color="text-ink" />
        {Object.entries(expByCategory).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([cat, amt]) => (
          <StatTile key={cat} label={CATEGORY_LABELS[cat] ?? cat} value={amt} color="text-ink/70" />
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Dépenses</CardTitle>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              {showForm ? "Annuler" : "+ Ajouter dépense"}
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Add form */}
          {showForm && (
            <form
              ref={formRef}
              action={handleAdd}
              className="rounded-xl border border-ink/10 bg-white/60 p-4 space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Nouvelle dépense</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Titre *</label>
                  <input name="title" required placeholder="Ex: Abonnement Figma" className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Montant (DT) *</label>
                  <input name="amount_dt" type="number" step="0.01" min="0" required placeholder="0.00" className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Catégorie</label>
                  <select name="category" defaultValue="other" className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Date</label>
                  <input name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Fournisseur</label>
                  <input name="vendor" placeholder="Ex: Adobe" className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Méthode de paiement</label>
                  <input name="payment_method" placeholder="Virement, carte…" className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Projet (optionnel)</label>
                  <select name="project_id" className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20">
                    <option value="">— Aucun —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Client (optionnel)</label>
                  <select name="client_id" className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20">
                    <option value="">— Aucun —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Notes</label>
                  <input name="notes" placeholder="Notes optionnelles" className="mt-1 w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
              </div>
              <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark">
                Enregistrer
              </button>
            </form>
          )}

          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={filterCat === "all"} onClick={() => setFilterCat("all")}>Tout</FilterPill>
            {EXPENSE_CATEGORIES.map((c) => (
              <FilterPill key={c.value} active={filterCat === c.value} onClick={() => setFilterCat(c.value)}>
                {c.label}
              </FilterPill>
            ))}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/40">Aucune dépense enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/8 text-left text-xs font-semibold uppercase tracking-wider text-ink/40">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Titre</th>
                    <th className="pb-2">Catégorie</th>
                    <th className="pb-2">Projet/Client</th>
                    <th className="pb-2 text-right">Montant</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} className="border-b border-ink/5 last:border-0 hover:bg-white/40">
                      <td className="py-2.5 text-ink/55">{formatDate(e.expense_date)}</td>
                      <td className="py-2.5">
                        <p className="font-medium text-ink">{e.title}</p>
                        {e.vendor && <p className="text-xs text-ink/40">{e.vendor}</p>}
                      </td>
                      <td className="py-2.5">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", CATEGORY_COLORS[e.category] ?? "bg-ink/8 text-ink/55")}>
                          {CATEGORY_LABELS[e.category] ?? e.category}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-ink/55">
                        {e.project_name ?? e.client_name ?? "—"}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-red-600">
                        {formatDt(e.amount_dt)}
                      </td>
                      <td className="py-2.5 pl-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(e.id)}
                          className="rounded p-1 text-ink/30 hover:bg-red-50 hover:text-red-500"
                          aria-label="Supprimer"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-ink/15">
                    <td colSpan={4} className="pt-2.5 text-xs font-semibold uppercase tracking-wider text-ink/50">Total affiché</td>
                    <td className="pt-2.5 text-right font-bold text-red-600">{formatDt(filtered.reduce((s,e)=>s+e.amount_dt,0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-ink/8 bg-white/50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">{label}</p>
      <p className={cn("mt-2 text-xl font-bold", color)}>{formatDt(value)}</p>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-brand text-white" : "bg-ink/6 text-ink/60 hover:bg-ink/10",
      )}
    >
      {children}
    </button>
  );
}
