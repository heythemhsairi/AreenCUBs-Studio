import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollText } from "lucide-react";
import { formatDateTimeShort } from "@/lib/format";

/**
 * The audit trail, read.
 *
 * Phase 2 made `audit_log` append-only — INSERT and SELECT policies exist,
 * UPDATE and DELETE do not, so nothing reaching the table through RLS can
 * revise history. This page is the other half of that promise: a record
 * nobody reads is not an audit trail, it is a table.
 *
 * Admin sees everything (RLS: audit_log_admin_select). The page never writes.
 */

const ACTION_TONE: Record<string, Tone> = {
  "content.approved": "green",
  "content.revision_requested": "amber",
  "review.comment": "amber",
  "review.version_uploaded": "cyan",
  "review.asset_created": "cyan",
  "review.status_changed": "blue",
  "devis.draft_created": "violet",
  "devis.draft_updated": "violet",
};

export default async function AuditPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: entries }, { data: profiles }] = await Promise.all([
    supabase
      .from("audit_log")
      .select("id, actor_id, actor_role, action, entity_type, entity_id, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("id, full_name, username"),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.username]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d'audit"
        description="Mutations significatives, en ajout seul : aucune politique de modification ou de suppression n'existe sur cette table. 200 dernières entrées."
      />

      <Card>
        <CardHeader>
          <CardTitle>Entrées</CardTitle>
        </CardHeader>
        <CardContent>
          {!entries || entries.length === 0 ? (
            <EmptyState
              icon={<ScrollText />}
              title="Aucune entrée"
              description="Les actions importantes — validations client, versions de montage, brouillons financiers — apparaîtront ici."
              size="sm"
            />
          ) : (
            <ul className="divide-y divide-[var(--c-border)]">
              {entries.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-medium">
                        {e.actor_id ? (nameById.get(e.actor_id) ?? "—") : "Système"}
                      </span>
                      {e.actor_role && (
                        <span className="text-content-3"> ({e.actor_role})</span>
                      )}
                      {e.summary && <span className="text-content-2"> — {e.summary}</span>}
                    </p>
                    <p className="text-xs text-content-3">
                      {e.entity_type}
                      {e.entity_id ? ` · ${e.entity_id.slice(0, 8)}…` : ""}
                      {" · "}
                      {formatDateTimeShort(e.created_at)}
                    </p>
                  </div>
                  <Badge tone={ACTION_TONE[e.action] ?? "slate"}>{e.action}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
