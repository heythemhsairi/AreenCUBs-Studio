import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The portal's client-facing surface, asserted as a property of the source.
 *
 * `portal_tasks` and `portal_content_items` (see the migrations under
 * `supabase/migrations/`) already omit these columns at the view level — a
 * client role holds no grant that could read them even if this file tried.
 * This test exists for the second, cheaper layer: nobody redesigning the
 * portal's UI should be able to reintroduce an internal-only field name here
 * without a test failing immediately, long before it would matter that the
 * view wouldn't actually return it.
 *
 * Mirrors the source-property style of `error.test.tsx` — scanning the
 * files rather than rendering them, because the failure mode under test is
 * "this identifier appears in the client-facing bundle", not "the component
 * renders incorrectly".
 */

const PORTAL_SOURCE_FILES = [
  "src/app/portal/page.tsx",
  "src/app/portal/portal-client.tsx",
  "src/app/portal/actions.ts",
  "src/app/portal/review/[assetId]/page.tsx",
  "src/app/portal/review/[assetId]/player-client.tsx",
  "src/components/portal/portal-nav.tsx",
  "src/components/portal/task-workspace.tsx",
  "src/components/portal/mini-calendar.tsx",
  "src/components/portal/portal-charts.tsx",
  "src/lib/portal/tasks.ts",
  "src/lib/portal/calendar.ts",
];

// Internal-only columns from public.tasks / public.content_items (see
// supabase/migrations/20260506000001_initial_schema.sql and
// 20260811000006_client_portal.sql) that the client must never see a trace
// of, even as a fetched-but-unused field.
const FORBIDDEN_IDENTIFIERS = [
  "assignee_id",
  "assigned_to",
  "priority",
  "payroll",
  "created_by",
  "visual_direction",
  "pillar",
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("portal surface never references internal-only fields", () => {
  for (const relPath of PORTAL_SOURCE_FILES) {
    it(`${relPath} names no staff/priority/payroll/creator column`, () => {
      const code = stripComments(readFileSync(join(process.cwd(), relPath), "utf8"));
      for (const identifier of FORBIDDEN_IDENTIFIERS) {
        expect(code).not.toMatch(new RegExp(`\\b${identifier}\\b`));
      }
    });
  }
});
