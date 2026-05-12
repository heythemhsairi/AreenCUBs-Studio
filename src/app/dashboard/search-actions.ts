"use server";

import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SearchHit = {
  id: string;
  kind: "client" | "project" | "devis" | "facture" | "task" | "member";
  label: string;
  sublabel?: string | null;
  href: string;
};

export async function searchAction(
  query: string,
): Promise<{ ok: true; hits: SearchHit[] } | { ok: false; error: string }> {
  await requireSession();
  const trimmed = query.trim();
  if (trimmed.length < 2) return { ok: true, hits: [] };

  const q = `%${trimmed}%`;
  const supabase = await createClient();

  const [clients, projects, tasks, members, devisRows] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, email")
      .ilike("name", q)
      .limit(5),
    supabase
      .from("projects")
      .select("id, name, clients:client_id(name)")
      .ilike("name", q)
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, projects:project_id(name)")
      .ilike("title", q)
      .limit(5),
    supabase
      .from("profiles")
      .select("id, username, full_name, job_title")
      .or(`username.ilike.${q},full_name.ilike.${q}`)
      .limit(5),
    // Devis/facture by client name (devis_number is integer; querying by
    // number is rare, skip for simplicity)
    supabase
      .from("devis")
      .select(
        "id, kind, devis_number, total_dt, clients:client_id(name)",
      )
      .ilike("clients.name", q)
      .limit(5),
  ]);

  const hits: SearchHit[] = [];

  for (const c of clients.data ?? []) {
    hits.push({
      id: c.id,
      kind: "client",
      label: c.name,
      sublabel: c.email,
      href: `/dashboard/clients/${c.id}`,
    });
  }
  for (const p of projects.data ?? []) {
    const c = Array.isArray(p.clients) ? p.clients[0] : p.clients;
    hits.push({
      id: p.id,
      kind: "project",
      label: p.name,
      sublabel: c?.name,
      href: `/dashboard/projects/${p.id}`,
    });
  }
  for (const tk of tasks.data ?? []) {
    const proj = Array.isArray(tk.projects) ? tk.projects[0] : tk.projects;
    hits.push({
      id: tk.id,
      kind: "task",
      label: tk.title,
      sublabel: proj?.name,
      href: `/dashboard/tasks/${tk.id}`,
    });
  }
  for (const m of members.data ?? []) {
    hits.push({
      id: m.id,
      kind: "member",
      label: m.full_name ?? `@${m.username}`,
      sublabel: m.job_title,
      href: `/dashboard/team/${m.id}`,
    });
  }
  for (const d of devisRows.data ?? []) {
    const c = Array.isArray(d.clients) ? d.clients[0] : d.clients;
    if (!c) continue; // ilike on joined table can return rows w/o the join matching
    const kind = (d.kind as "devis" | "facture") ?? "devis";
    const baseUrl =
      kind === "facture" ? "/dashboard/factures" : "/dashboard/devis";
    hits.push({
      id: d.id,
      kind,
      label: `${kind === "facture" ? "FACT" : "EST"}-${String(d.devis_number).padStart(7, "0")}`,
      sublabel: `${c.name} · ${Number(d.total_dt).toFixed(2)} DT`,
      href: `${baseUrl}/${d.id}`,
    });
  }

  return { ok: true, hits };
}
