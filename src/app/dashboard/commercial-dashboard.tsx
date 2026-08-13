import { createClient } from "@/lib/supabase/server";
import { CommercialDashboardClient, type CommercialDoc, type CommercialClientRow } from "./commercial-client";
import type { SessionProfile } from "@/lib/auth";
import { toBusinessDateKey } from "@/lib/format";

/**
 * The commercial dashboard.
 *
 * Reached by an early return in the main dashboard page, before any of the
 * agency-wide finance queries run. That ordering is the point: a commercial
 * must not see global totals, and the strongest way to guarantee it is that
 * the queries producing them are never issued for this session. Hiding a
 * rendered figure behind a conditional would leave the number one refactor
 * away from being displayed, and one network tab away from being read.
 *
 * Every query below goes through the RLS-bound client, so the database returns
 * only this user's clients and their documents. The scoping is not written
 * here; it is `commercial_owns_client()` in migration
 * 20260811000003 and it is asserted by scripts/db/role-matrix.dbtest.mjs.
 * This component therefore does no filtering of its own — if it had to, that
 * would mean the policy was not doing its job.
 */
export async function CommercialDashboard({ session }: { session: SessionProfile }) {
  const supabase = await createClient();

  const [clientsRes, docsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, email, phone, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("devis")
      .select("id, devis_number, kind, client_id, object, status, date, due_date, total_dt")
      .order("date", { ascending: false }),
  ]);

  // A failed query must not take the page down; it renders as an empty state
  // with the error surfaced, which is honest about what is missing.
  const loadError =
    clientsRes.error?.message ?? docsRes.error?.message ?? null;

  const clients: CommercialClientRow[] = (clientsRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
  }));

  const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

  const docs: CommercialDoc[] = (docsRes.data ?? []).map((d) => ({
    id: d.id,
    number: d.devis_number,
    kind: d.kind,
    clientName: clientNameById.get(d.client_id) ?? "—",
    object: d.object,
    status: d.status,
    dueDate: d.due_date,
    total: Number(d.total_dt ?? 0),
  }));

  // "Overdue" is decided here, on the server, and passed down as a plain
  // boolean. Deciding it in the browser instead would compare a UTC server
  // render against an Africa/Tunis client clock — the exact asymmetry that
  // produced the #418 hydration errors this project has already paid for once.
  const todayKey = toBusinessDateKey(new Date()) ?? "";

  const drafts = docs.filter((d) => d.status === "draft");
  const awaiting = docs.filter((d) => d.status === "sent");
  const overdue = awaiting.filter((d) => d.dueDate !== null && d.dueDate < todayKey);

  // The personal pipeline: what this commercial has in play. Not an agency
  // total — it spans only the clients they own, which is all RLS returns.
  const pipeline = [...drafts, ...awaiting].reduce((sum, d) => sum + d.total, 0);

  return (
    <CommercialDashboardClient
      firstName={(session.full_name ?? session.username).split(" ")[0]}
      clients={clients}
      drafts={drafts}
      awaiting={awaiting}
      overdue={overdue}
      pipeline={pipeline}
      loadError={loadError}
    />
  );
}
