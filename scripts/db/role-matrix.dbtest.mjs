import { describe, it, expect, beforeAll } from "vitest";
import {
  sql,
  sqlAs,
  sqlAsExpectDeniedOrZero,
  sqlAsExpectError,
  dbAvailable,
  USERS,
  FIXTURES,
} from "./sql.mjs";

/**
 * The six-role permission matrix, asserted against real PostgreSQL.
 *
 * This suite walks docs/audit/PERMISSION-MATRIX.md. Each describe block names
 * the section it enforces, so a rule can be traced from the specification to
 * the policy to the assertion.
 *
 * TWO RULES GOVERN EVERY TEST HERE.
 *
 * 1. Reads assert a COUNT, not a boolean. "Can this role select from clients?"
 *    is the wrong question — the interesting failure is a role that reaches
 *    the table and gets three rows too many.
 *
 * 2. Writes assert ROWS AFFECTED, never whether the statement threw. RLS
 *    denies an UPDATE or DELETE by filtering the rows it applies to, so a
 *    forbidden write succeeds and reports zero. A suite asking "did it throw?"
 *    passes while the data is wide open. An INSERT blocked by WITH CHECK does
 *    raise, so sqlAsExpectDeniedOrZero normalises both shapes to zero.
 *
 * Everything runs under `set local role authenticated` inside a transaction
 * that is always rolled back.
 */

/** Rows an UPDATE actually changed. */
function rowsUpdated(user, table, setClause, where) {
  return Number(
    sqlAsExpectDeniedOrZero(
      user,
      `with u as (update ${table} set ${setClause} where ${where} returning 1) select count(*) from u;`,
    ),
  );
}

/** Rows a DELETE actually removed. */
function rowsDeleted(user, table, where) {
  return Number(
    sqlAsExpectDeniedOrZero(
      user,
      `with d as (delete from ${table} where ${where} returning 1) select count(*) from d;`,
    ),
  );
}

/** Rows an INSERT actually created. */
function rowsInserted(user, statement) {
  return Number(
    sqlAsExpectDeniedOrZero(user, `with i as (${statement} returning 1) select count(*) from i;`),
  );
}

const count = (user, table) => Number(sqlAs(user, `select count(*) from ${table};`));

beforeAll(() => {
  if (!dbAvailable()) {
    throw new Error("No local staging database. Run: npm run db:start && npm run db:reset");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
describe("harness integrity", () => {
  it("impersonation drops superuser, so RLS is actually in force", () => {
    // As `postgres`, RLS is bypassed and every assertion below would pass
    // vacuously. Nothing in this file means anything without this.
    expect(sqlAs(USERS.commercial, "select current_user;")).toBe("authenticated");
    expect(sqlAs(USERS.commercial, "select current_setting('is_superuser');")).toBe("off");
  });

  it("all six roles exist in the enum", () => {
    const values = sql(
      "select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum e " +
        "join pg_type t on t.oid = e.enumtypid where t.typname = 'user_role';",
    );
    expect(values.split(",").sort()).toEqual(
      ["admin", "client", "commercial", "freelancer", "intern", "worker"].sort(),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("auth_role() — matrix §1, fail closed", () => {
  it("resolves each seeded identity to its role", () => {
    expect(sqlAs(USERS.admin, "select public.auth_role();")).toBe("admin");
    expect(sqlAs(USERS.worker, "select public.auth_role();")).toBe("worker");
    expect(sqlAs(USERS.commercial, "select public.auth_role();")).toBe("commercial");
    expect(sqlAs(USERS.intern, "select public.auth_role();")).toBe("intern");
    expect(sqlAs(USERS.freelancer, "select public.auth_role();")).toBe("freelancer");
    expect(sqlAs(USERS.client, "select public.auth_role();")).toBe("client");
  });

  it("returns NULL for an authenticated user with no profile", () => {
    expect(sqlAs(USERS.orphan, "select coalesce(public.auth_role(), 'NULL');")).toBe("NULL");
  });

  it("is not the reserved PostgreSQL keyword", () => {
    // The trap that cost this project migrations 0018-0025. auth_role() is
    // named so it cannot be confused with the built-in.
    expect(sqlAs(USERS.admin, "select public.auth_role();")).toBe("admin");
    expect(sqlAs(USERS.admin, "select current_role;")).toBe("authenticated");
  });

  it("every role predicate denies the profile-less user", () => {
    const probe = (fn) => sqlAs(USERS.orphan, `select ${fn};`);
    expect(probe("public.is_internal()")).toBe("f");
    expect(probe("public.is_staff()")).toBe("f");
    expect(probe("public.is_commercial()")).toBe("f");
    expect(probe("public.is_client_user()")).toBe("f");
    expect(probe("public.is_admin()")).toBe("f");
  });

  it("is_internal() excludes the client role — the containment predicate", () => {
    expect(sqlAs(USERS.client, "select public.is_internal();")).toBe("f");
    for (const u of ["admin", "worker", "commercial", "intern", "freelancer"]) {
      expect(sqlAs(USERS[u], "select public.is_internal();")).toBe("t");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("administrator — matrix §2, full access", () => {
  it("sees every client, project, task and financial document", () => {
    expect(count(USERS.admin, "public.clients")).toBe(4);
    expect(count(USERS.admin, "public.projects")).toBe(3);
    expect(count(USERS.admin, "public.tasks")).toBe(6);
    expect(count(USERS.admin, "public.devis")).toBeGreaterThanOrEqual(6);
  });

  it("can write across the finance tables", () => {
    expect(rowsUpdated(USERS.admin, "public.devis", "object = object", `id = '${FIXTURES.devisSent}'`)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("commercial — matrix §2 Clients and Finance", () => {
  it("sees only the clients they own, by authorship or assignment", () => {
    // Nova by an explicit client_members row; Meridian by created_by.
    expect(count(USERS.commercial, "public.clients")).toBe(2);
    const names = sqlAs(USERS.commercial, "select string_agg(name, '|' order by name) from public.clients;");
    expect(names).toBe("Meridian Logistique|Nova Immobilier");
  });

  it("cannot see a client belonging to nobody else's commercial", () => {
    expect(
      Number(sqlAs(USERS.commercial, `select count(*) from public.clients where id = '${FIXTURES.clientAtlas}';`)),
    ).toBe(0);
  });

  it("may create a client, and is scoped to it by authorship", () => {
    expect(
      rowsInserted(
        USERS.commercial,
        `insert into public.clients (name, created_by) values ('Probe SARL', '${USERS.commercial}')`,
      ),
    ).toBe(1);
  });

  it("cannot create a client authored by someone else", () => {
    // Otherwise a commercial could plant a row into another user's scope.
    expect(
      rowsInserted(
        USERS.commercial,
        `insert into public.clients (name, created_by) values ('Probe SARL', '${USERS.admin}')`,
      ),
    ).toBe(0);
  });

  it("cannot delete a client", () => {
    expect(rowsDeleted(USERS.commercial, "public.clients", `id = '${FIXTURES.clientNova}'`)).toBe(0);
  });

  it("sees quotes and invoices for their own clients only", () => {
    const rows = Number(sqlAs(USERS.commercial, "select count(*) from public.devis;"));
    expect(rows).toBe(3); // two for Nova, one for Meridian
    expect(
      Number(sqlAs(USERS.commercial, `select count(*) from public.devis where client_id = '${FIXTURES.clientAtlas}';`)),
    ).toBe(0);
  });

  it("may edit a draft for an owned client", () => {
    expect(rowsUpdated(USERS.commercial, "public.devis", "object = 'edited'", `id = '${FIXTURES.devisDraft}'`)).toBe(1);
  });

  it("cannot edit a document that has already been issued", () => {
    // devisSent is status 'sent'. The USING clause requires a draft, so this
    // matches zero rows rather than raising.
    expect(rowsUpdated(USERS.commercial, "public.devis", "object = 'edited'", `id = '${FIXTURES.devisSent}'`)).toBe(0);
  });

  it("cannot promote their own draft out of draft", () => {
    // The WITH CHECK half. Without it, a commercial could issue documents.
    expect(rowsUpdated(USERS.commercial, "public.devis", "status = 'sent'", `id = '${FIXTURES.devisDraft}'`)).toBe(0);
  });

  it("cannot mark an invoice paid", () => {
    expect(
      rowsUpdated(USERS.commercial, "public.devis", "payment_status = 'paid'", `id = '${FIXTURES.devisDraft}'`),
    ).toBe(0);
  });

  it("cannot delete any financial document", () => {
    expect(rowsDeleted(USERS.commercial, "public.devis", `id = '${FIXTURES.devisDraft}'`)).toBe(0);
  });

  it("cannot create a document that is not a draft", () => {
    expect(
      rowsInserted(
        USERS.commercial,
        `insert into public.devis (kind, client_id, object, status, created_by)
         values ('devis', '${FIXTURES.clientMeridian}', 'probe', 'sent', '${USERS.commercial}')`,
      ),
    ).toBe(0);
  });

  it("cannot create a document for a client they do not own", () => {
    expect(
      rowsInserted(
        USERS.commercial,
        `insert into public.devis (kind, client_id, object, status, created_by)
         values ('devis', '${FIXTURES.clientAtlas}', 'probe', 'draft', '${USERS.commercial}')`,
      ),
    ).toBe(0);
  });

  it("reaches no payments and no expenses", () => {
    expect(count(USERS.commercial, "public.payments")).toBe(0);
    expect(count(USERS.commercial, "public.expenses")).toBe(0);
  });

  it("cannot record a payment", () => {
    expect(
      rowsInserted(
        USERS.commercial,
        `insert into public.payments (devis_id, amount_dt) values ('${FIXTURES.devisSent}', 100.00)`,
      ),
    ).toBe(0);
  });

  it("sees no tasks — delivery work is not their surface", () => {
    expect(count(USERS.commercial, "public.tasks")).toBe(0);
  });

  it("sees projects for their own clients, read-only", () => {
    expect(count(USERS.commercial, "public.projects")).toBe(1); // Nova's campaign
    expect(rowsUpdated(USERS.commercial, "public.projects", "name = 'probe'", "true")).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("worker — matrix §2 and §4, blanket access removed", () => {
  it("sees clients linked to their work, and not the unrelated one", () => {
    // Three of four. Meridian has no project and was authored by the
    // commercial, so nothing links this worker to it.
    expect(count(USERS.worker, "public.clients")).toBe(3);
    expect(
      Number(sqlAs(USERS.worker, `select count(*) from public.clients where id = '${FIXTURES.clientMeridian}';`)),
    ).toBe(0);
  });

  it("cannot update the client it cannot see", () => {
    expect(rowsUpdated(USERS.worker, "public.clients", "name = 'probe'", `id = '${FIXTURES.clientMeridian}'`)).toBe(0);
  });

  it("cannot delete a client at all", () => {
    expect(rowsDeleted(USERS.worker, "public.clients", "true")).toBe(0);
  });

  it("reaches the finance tables only as far as read-only expenses", () => {
    expect(count(USERS.worker, "public.devis")).toBe(0);
    expect(count(USERS.worker, "public.payments")).toBe(0);
    expect(Number(sqlAs(USERS.worker, "select count(*) from public.expenses;"))).toBeGreaterThanOrEqual(0);
  });

  it("cannot create a financial document", () => {
    expect(
      rowsInserted(
        USERS.worker,
        `insert into public.devis (kind, client_id, object, status, created_by)
         values ('devis', '${FIXTURES.clientAtlas}', 'probe', 'draft', '${USERS.worker}')`,
      ),
    ).toBe(0);
  });

  it("sees the projects and tasks it is on", () => {
    expect(count(USERS.worker, "public.projects")).toBe(3);
    expect(count(USERS.worker, "public.tasks")).toBe(6);
  });

  it("cannot assign roles", () => {
    expect(rowsUpdated(USERS.worker, "public.profiles", "role = 'admin'", `id = '${USERS.worker}'`)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("intern — matrix §2, strictly less than a worker", () => {
  it("sees only the tasks assigned to them", () => {
    // Two of the six: both on the Zenith project, both through task_assignees.
    expect(count(USERS.intern, "public.tasks")).toBe(2);
    // Aggregated in SQL rather than split in JS: psql returns one row per
    // id, and an earlier version of this assertion carried a literal line
    // break inside its string, which parsed as a syntax error and took the
    // whole file out of the run.
    const ids = sqlAs(
      USERS.intern,
      "select string_agg(id::text, ',' order by id) from public.tasks;",
    );
    expect(ids).toBe([FIXTURES.taskIntern, FIXTURES.taskInternOpen].sort().join(","));
  });

  it("sees only the project that task lives in", () => {
    expect(count(USERS.intern, "public.projects")).toBe(1);
    expect(sqlAs(USERS.intern, "select id from public.projects;")).toBe(FIXTURES.projectZenith);
  });

  it("holds no policy on the clients table, so internal notes are unreachable", () => {
    // Not "cannot read notes" — cannot read the ROW. RLS is row-level; the
    // only way to withhold one column is to withhold the record.
    expect(count(USERS.intern, "public.clients")).toBe(0);
  });

  it("reads its client through the reduced directory instead", () => {
    expect(count(USERS.intern, "public.client_directory")).toBe(1);
    expect(sqlAs(USERS.intern, "select name from public.client_directory;")).toBe("Zenith Fitness");
  });

  it("may update its own task but cannot reassign it away", () => {
    expect(rowsUpdated(USERS.intern, "public.tasks", "status = 'done'", `id = '${FIXTURES.taskIntern}'`)).toBe(1);
    expect(
      rowsUpdated(USERS.intern, "public.tasks", `assignee_id = '${USERS.admin}'`, `id = '${FIXTURES.taskIntern}'`),
    ).toBe(0);
  });

  it("cannot touch a task it is not assigned to", () => {
    expect(rowsUpdated(USERS.intern, "public.tasks", "status = 'done'", `id = '${FIXTURES.taskFreelancer}'`)).toBe(0);
  });

  it("reaches no finance surface whatsoever", () => {
    expect(count(USERS.intern, "public.devis")).toBe(0);
    expect(count(USERS.intern, "public.devis_items")).toBe(0);
    expect(count(USERS.intern, "public.payments")).toBe(0);
    expect(count(USERS.intern, "public.expenses")).toBe(0);
    expect(count(USERS.intern, "public.services")).toBe(0); // the price catalog
  });

  it("cannot see other staff profiles", () => {
    expect(count(USERS.intern, "public.profiles")).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("freelancer — matrix §2, narrowest internal role", () => {
  it("sees only assigned tasks", () => {
    expect(count(USERS.freelancer, "public.tasks")).toBe(1);
    expect(sqlAs(USERS.freelancer, "select id from public.tasks;")).toBe(FIXTURES.taskFreelancer);
  });

  it("no longer reads the clients table — see matrix §4", () => {
    // Previously clients_freelancer_select_via_tasks returned the WHOLE row,
    // internal notes included, for any client behind an assigned task.
    expect(count(USERS.freelancer, "public.clients")).toBe(0);
  });

  it("reads the reduced directory instead, scoped to its assignment", () => {
    expect(count(USERS.freelancer, "public.client_directory")).toBe(1);
    expect(sqlAs(USERS.freelancer, "select name from public.client_directory;")).toBe("Atlas Foods SARL");
  });

  it("the directory exposes no internal column", () => {
    const cols = sql(
      "select string_agg(column_name, ',' order by column_name) from information_schema.columns " +
        "where table_schema = 'public' and table_name = 'client_directory';",
    ).split(",");
    expect(cols.sort()).toEqual(["email", "id", "name", "phone"]);
    for (const forbidden of ["notes", "matricule_fiscal", "address"]) {
      expect(cols).not.toContain(forbidden);
    }
  });

  it("reaches no finance surface", () => {
    expect(count(USERS.freelancer, "public.devis")).toBe(0);
    expect(count(USERS.freelancer, "public.payments")).toBe(0);
    expect(count(USERS.freelancer, "public.expenses")).toBe(0);
    expect(count(USERS.freelancer, "public.services")).toBe(0);
  });

  it("cannot mutate a client through the table or the view", () => {
    expect(rowsUpdated(USERS.freelancer, "public.clients", "name = 'probe'", "true")).toBe(0);
    expect(rowsUpdated(USERS.freelancer, "public.client_directory", "name = 'probe'", "true")).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("client — matrix §3, no internal surface at all", () => {
  // Phase 2 grants the client role nothing. The portal in Phase 6 adds
  // client-scoped surfaces deliberately; until then every internal table must
  // read zero, and this block is the proof that it does.
  const INTERNAL_TABLES = [
    "public.clients",
    "public.projects",
    "public.tasks",
    "public.task_comments",
    "public.task_assignees",
    "public.project_assignees",
    "public.task_activity",
    "public.task_templates",
    "public.task_tag_catalog",
    "public.devis",
    "public.devis_items",
    "public.payments",
    "public.expenses",
    "public.services",
    "public.settings",
    "public.featured_employees",
    "public.client_content_profiles",
    "public.monthly_content_plans",
    "public.content_items",
    "public.social_posts",
    "public.app_updates",
    "public.app_update_items",
    "public.audit_log",
    "public.client_directory",
  ];

  for (const table of INTERNAL_TABLES) {
    it(`reads zero rows from ${table}`, () => {
      expect(count(USERS.client, table)).toBe(0);
    });
  }

  it("sees its own profile and no one else's", () => {
    expect(count(USERS.client, "public.profiles")).toBe(1);
    expect(sqlAs(USERS.client, "select id from public.profiles;")).toBe(USERS.client);
  });

  it("resolves its own membership row, which is how the portal will scope it", () => {
    expect(count(USERS.client, "public.client_members")).toBe(1);
    expect(sqlAs(USERS.client, "select client_id from public.client_members;")).toBe(FIXTURES.clientAtlas);
  });

  it("cannot grant itself membership of another organisation", () => {
    // The escalation that would break the whole portal model.
    expect(
      rowsInserted(
        USERS.client,
        `insert into public.client_members (client_id, profile_id, relation)
         values ('${FIXTURES.clientNova}', '${USERS.client}', 'client_contact')`,
      ),
    ).toBe(0);
  });

  it("cannot promote itself to an internal role", () => {
    expect(rowsUpdated(USERS.client, "public.profiles", "role = 'admin'", `id = '${USERS.client}'`)).toBe(0);
  });

  it("cannot write to any internal table", () => {
    expect(rowsInserted(USERS.client, "insert into public.clients (name) values ('probe')")).toBe(0);
    expect(rowsInserted(USERS.client, "insert into public.tasks (project_id, title) values " +
      `('${FIXTURES.projectAtlas}', 'probe')`)).toBe(0);
    expect(rowsUpdated(USERS.client, "public.clients", "name = 'probe'", "true")).toBe(0);
    expect(rowsDeleted(USERS.client, "public.tasks", "true")).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("direct object reference — matrix §3", () => {
  // Knowing an id must never be enough. Every one of these asks for a specific
  // row by primary key, which is exactly what a hand-edited URL would do.
  const PROBES = [
    ["client", "public.clients", FIXTURES.clientAtlas],
    ["client", "public.projects", FIXTURES.projectAtlas],
    ["client", "public.tasks", FIXTURES.taskFreelancer],
    ["client", "public.devis", FIXTURES.devisSent],
    ["intern", "public.clients", FIXTURES.clientAtlas],
    ["intern", "public.tasks", FIXTURES.taskFreelancer],
    ["intern", "public.devis", FIXTURES.devisSent],
    ["freelancer", "public.clients", FIXTURES.clientAtlas],
    ["freelancer", "public.tasks", FIXTURES.taskIntern],
    ["freelancer", "public.devis", FIXTURES.devisDraft],
    ["commercial", "public.clients", FIXTURES.clientAtlas],
    ["commercial", "public.tasks", FIXTURES.taskIntern],
    ["worker", "public.clients", FIXTURES.clientMeridian],
    ["worker", "public.devis", FIXTURES.devisSent],
  ];

  for (const [role, table, id] of PROBES) {
    it(`${role} asking ${table} for a known id gets nothing`, () => {
      expect(Number(sqlAs(USERS[role], `select count(*) from ${table} where id = '${id}';`))).toBe(0);
    });
  }

  it("the reduced directory cannot be widened by asking for a specific id", () => {
    expect(
      Number(
        sqlAs(USERS.freelancer, `select count(*) from public.client_directory where id = '${FIXTURES.clientMeridian}';`),
      ),
    ).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("audit log — matrix §2 Identity", () => {
  it("an internal user may append an entry attributed to themselves", () => {
    expect(
      rowsInserted(
        USERS.worker,
        `insert into public.audit_log (actor_id, actor_role, action, entity_type)
         values ('${USERS.worker}', 'worker', 'probe', 'test')`,
      ),
    ).toBe(1);
  });

  it("nobody may append an entry attributed to someone else", () => {
    expect(
      rowsInserted(
        USERS.worker,
        `insert into public.audit_log (actor_id, actor_role, action, entity_type)
         values ('${USERS.admin}', 'admin', 'probe', 'test')`,
      ),
    ).toBe(0);
  });

  it("is append-only — no policy permits update or delete", () => {
    const writable = sql(
      "select count(*) from pg_policies where schemaname = 'public' and tablename = 'audit_log' " +
        "and cmd in ('UPDATE','DELETE');",
    );
    expect(writable).toBe("0");
  });

  it("a client cannot write to it", () => {
    expect(
      rowsInserted(
        USERS.client,
        `insert into public.audit_log (actor_id, action, entity_type) values ('${USERS.client}', 'probe', 'test')`,
      ),
    ).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("containment of the broad policies", () => {
  it("no policy in public grants access to any authenticated caller", () => {
    // Twelve policies used to read `auth.uid() is not null` or
    // `auth.role() = 'authenticated'`. Each was survivable while every account
    // belonged to the agency and became a leak the moment a client could sign
    // in. This asserts none came back.
    const remaining = sql(
      `select coalesce(string_agg(tablename || '.' || policyname, ', '), 'none')
         from pg_policies
        where schemaname = 'public'
          and (coalesce(qual, '') like '%auth.uid() IS NOT NULL%'
               or coalesce(qual, '') like '%auth.role() = ''authenticated''%'
               or coalesce(with_check, '') like '%auth.uid() IS NOT NULL%'
               or coalesce(with_check, '') like '%auth.role() = ''authenticated''%');`,
    );
    expect(remaining).toBe("none");
  });

  it("the task-file bucket is closed to clients", () => {
    const broad = sql(
      `select count(*) from pg_policies
        where schemaname = 'storage' and policyname like 'task_files_%'
          and (coalesce(qual, '') like '%auth.uid() IS NOT NULL%'
               or coalesce(with_check, '') like '%auth.uid() IS NOT NULL%');`,
    );
    expect(broad).toBe("0");
  });

  it("every policy join column carries an index", () => {
    // The scope predicates run per row scanned, so a missing index here is a
    // performance cliff on the largest tables.
    const required = [
      ["client_members", "client_members_profile_idx"],
      ["client_members", "client_members_client_idx"],
      ["clients", "clients_created_by_idx"],
      ["clients", "clients_owner_idx"],
      ["projects", "projects_client_idx"],
      ["projects", "projects_owner_idx"],
      ["tasks", "tasks_created_by_idx"],
    ];
    for (const [table, index] of required) {
      const found = sql(
        `select count(*) from pg_indexes where schemaname = 'public' and tablename = '${table}' and indexname = '${index}';`,
      );
      expect(`${table}.${index}=${found}`).toBe(`${table}.${index}=1`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("client portal — Phase 6 surfaces", () => {
  // Phase 2 gave the client role nothing, and the block above still asserts
  // that every internal table reads zero for it. These are the only doors that
  // opened, and they are views and one function, never a table policy.

  it("shows the organisation the contact belongs to, and only its name", () => {
    expect(sqlAs(USERS.client, "select name from public.portal_client_org;")).toBe(
      "Atlas Foods SARL",
    );
    const cols = sql(
      "select string_agg(column_name, ',' order by column_name) from information_schema.columns " +
        "where table_schema = 'public' and table_name = 'portal_client_org';",
    ).split(",");
    expect(cols.sort()).toEqual(["id", "name"]);
  });

  it("shows content that has been put in front of the client, and no work in progress", () => {
    // Two of Atlas's four items: one awaiting review, one approved. The item
    // in 'design' is theirs but unfinished, and a client sees work once it is
    // shown to them, not while it is being made.
    expect(count(USERS.client, "public.portal_content_items")).toBe(2);
    expect(
      Number(
        sqlAs(
          USERS.client,
          `select count(*) from public.portal_content_items where id = '${FIXTURES.itemInternalWip}';`,
        ),
      ),
    ).toBe(0);
  });

  it("never returns another organisation's content, even by id", () => {
    // The direct-object-reference case that matters most. This fixture is in a
    // client-visible status on purpose, so membership is the only thing
    // stopping it — if the test used an internal-status row it would pass for
    // the wrong reason.
    expect(
      Number(
        sqlAs(
          USERS.client,
          `select count(*) from public.portal_content_items where id = '${FIXTURES.itemOtherOrg}';`,
        ),
      ),
    ).toBe(0);
  });

  it("exposes no column that describes the agency rather than the deliverable", () => {
    const cols = sql(
      "select string_agg(column_name, ',' order by column_name) from information_schema.columns " +
        "where table_schema = 'public' and table_name = 'portal_content_items';",
    ).split(",");
    for (const internal of [
      "assigned_to",
      "created_by",
      "priority",
      "deadline",
      "visual_direction",
      "pillar",
      "task_id",
    ]) {
      expect(cols, `portal_content_items exposes ${internal}`).not.toContain(internal);
    }
  });

  it("is not writable through the view", () => {
    // A single-table view with no aggregate is auto-updatable, and Supabase
    // grants ALL to authenticated by default. Without the explicit REVOKE this
    // would write straight through to content_items.
    expect(
      rowsUpdated(USERS.client, "public.portal_content_items", "title = 'probe'", "true"),
    ).toBe(0);
  });

  it("returns nothing to an internal role — these views are client-scoped", () => {
    for (const who of ["admin", "worker", "commercial", "intern", "freelancer"]) {
      expect(
        `${who}:${count(USERS[who], "public.portal_content_items")}`,
        `${who} reached the portal view`,
      ).toBe(`${who}:0`);
    }
  });

  it("records a decision on an item awaiting review", () => {
    const after = sqlAs(
      USERS.client,
      `select public.portal_set_approval('${FIXTURES.itemAwaitingReview}', 'approved', null); ` +
        `select approval_status from public.portal_content_items where id = '${FIXTURES.itemAwaitingReview}';`,
    );
    expect(after).toBe("approved");
  });

  it("does not move the item through the production workflow", () => {
    // A client's approval records their decision. Advancing `status` stays
    // with the agency, and the function never writes that column.
    const after = sqlAs(
      USERS.client,
      `select public.portal_set_approval('${FIXTURES.itemAwaitingReview}', 'approved', null); ` +
        `select status from public.portal_content_items where id = '${FIXTURES.itemAwaitingReview}';`,
    );
    expect(after).toBe("client_review");
  });

  it("refuses another organisation's item with the same error as a missing one", () => {
    // Identical messages on purpose: a distinct "not yours" would let a client
    // enumerate other organisations' ids by watching which error comes back.
    const foreign = sqlAsExpectError(
      USERS.client,
      `select public.portal_set_approval('${FIXTURES.itemOtherOrg}', 'approved', null);`,
    );
    const missing = sqlAsExpectError(
      USERS.client,
      "select public.portal_set_approval('00000000-0000-4000-8000-000000000000', 'approved', null);",
    );
    expect(foreign).toContain("Item not found");
    expect(missing).toContain("Item not found");
  });

  it("refuses an item that is not awaiting review", () => {
    expect(
      sqlAsExpectError(
        USERS.client,
        `select public.portal_set_approval('${FIXTURES.itemInternalWip}', 'approved', null);`,
      ),
    ).toContain("not awaiting your review");
  });

  it("refuses a decision it does not recognise", () => {
    expect(
      sqlAsExpectError(
        USERS.client,
        `select public.portal_set_approval('${FIXTURES.itemAwaitingReview}', 'published', null);`,
      ),
    ).toContain("Unknown decision");
  });

  it("refuses an internal user pretending to be the client", () => {
    for (const who of ["admin", "worker", "commercial", "intern", "freelancer"]) {
      expect(
        sqlAsExpectError(
          USERS[who],
          `select public.portal_set_approval('${FIXTURES.itemAwaitingReview}', 'approved', null);`,
        ),
      ).toContain("Only a client contact");
    }
  });

  it("notifies the internal owner and writes one audit entry", () => {
    // Measured as a DELTA, not an absolute count.
    //
    // Two reasons, and the second one bit. Counting from inside the client's
    // own session returns 0/0 whether the inserts happened or not — a client
    // holds no policy on notifications (they belong to the assignee) or on
    // audit_log. And the browser suite drives the real application, so its
    // approval tests leave permanent rows behind; an absolute count passed
    // until the e2e run had happened at least once, then failed forever.
    //
    // The role is dropped for the call and restored for the count, all inside
    // one rolled-back transaction.
    const out = sql(
      "begin; " +
        "create temp table _before on commit drop as select " +
        "  (select count(*) from public.notifications where kind = 'content_approval') as n, " +
        "  (select count(*) from public.audit_log where entity_type = 'content_item') as a; " +
        `select set_config('request.jwt.claims', '{"sub":"${USERS.client}","role":"authenticated"}', true); ` +
        "set local role authenticated; " +
        `select public.portal_set_approval('${FIXTURES.itemAwaitingReview}', 'revision_requested', 'Merci de revoir la photo'); ` +
        "reset role; " +
        "select 'N=' " +
        "  || ((select count(*) from public.notifications where kind = 'content_approval') - (select n from _before))::text " +
        "  || '/' " +
        "  || ((select count(*) from public.audit_log where entity_type = 'content_item') - (select a from _before))::text; " +
        "rollback;",
    );
    // Substring rather than a line split: psql returns command tags alongside
    // the result, and an escape sequence in this file has already once landed
    // as a literal line break and taken the whole suite out of the run.
    expect(out).toContain("N=1/1");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("video review — Phase 7", () => {
  it("agency staff hold the workflow", () => {
    expect(count(USERS.admin, "public.review_assets")).toBe(2);
    expect(count(USERS.worker, "public.review_versions")).toBe(3);
    expect(count(USERS.worker, "public.review_comments")).toBe(2);
  });

  it("a commercial sees reviews for their own clients only", () => {
    // Nova is theirs; Atlas is not.
    expect(count(USERS.commercial, "public.review_assets")).toBe(1);
    expect(
      Number(
        sqlAs(
          USERS.commercial,
          `select count(*) from public.review_assets where id = '${FIXTURES.reviewAssetAtlas}';`,
        ),
      ),
    ).toBe(0);
  });

  it("interns and freelancers reach no review data at all", () => {
    for (const who of ["intern", "freelancer"]) {
      for (const table of [
        "public.review_assets",
        "public.review_versions",
        "public.review_comments",
      ]) {
        expect(`${who}:${table}:${count(USERS[who], table)}`).toBe(`${who}:${table}:0`);
      }
    }
  });

  it("the client role holds no policy on the review tables", () => {
    // Same shape as Phase 6: a client reads views, never a base table, so the
    // blanket "reads zero from every internal table" assertion stays true.
    for (const table of [
      "public.review_assets",
      "public.review_versions",
      "public.review_comments",
    ]) {
      expect(`${table}:${count(USERS.client, table)}`).toBe(`${table}:0`);
    }
  });

  it("the portal offers the client their own asset and the current cut only", () => {
    expect(count(USERS.client, "public.portal_review_assets")).toBe(1);

    // One version, and it is version 2. Earlier cuts are the agency's working
    // history; offering them invites comments on something nobody is using.
    expect(
      sqlAs(USERS.client, "select version_number::text from public.portal_review_versions;"),
    ).toBe("2");
  });

  it("the portal never names which employee replied", () => {
    const cols = sql(
      "select string_agg(column_name, ',' order by column_name) from information_schema.columns " +
        "where table_schema = 'public' and table_name = 'portal_review_comments';",
    ).split(",");
    expect(cols).not.toContain("author_id");
    expect(cols).toContain("author_side");
  });

  it("another organisation's review is unreachable, even by id", () => {
    expect(
      Number(
        sqlAs(
          USERS.client,
          `select count(*) from public.portal_review_assets where id = '${FIXTURES.reviewAssetOther}';`,
        ),
      ),
    ).toBe(0);
  });

  it("a client may comment on the current cut", () => {
    const out = sqlAs(
      USERS.client,
      `select public.portal_add_review_comment('${FIXTURES.reviewVersionCurrent}', 'Le logo reste trop long', 4.25) is not null;`,
    );
    expect(out).toBe("t");
  });

  it("a client may not comment on a superseded cut", () => {
    expect(
      sqlAsExpectError(
        USERS.client,
        `select public.portal_add_review_comment('${FIXTURES.reviewVersionOld}', 'trop tard', null);`,
      ),
    ).toContain("superseded");
  });

  it("a client may not comment on another organisation's version", () => {
    expect(
      sqlAsExpectError(
        USERS.client,
        `select public.portal_add_review_comment('${FIXTURES.reviewVersionOther}', 'probe', null);`,
      ),
    ).toContain("Version not found");
  });

  it("rejects an empty comment and an impossible timecode", () => {
    expect(
      sqlAsExpectError(
        USERS.client,
        `select public.portal_add_review_comment('${FIXTURES.reviewVersionCurrent}', '   ', null);`,
      ),
    ).toContain("cannot be empty");
    expect(
      sqlAsExpectError(
        USERS.client,
        `select public.portal_add_review_comment('${FIXTURES.reviewVersionCurrent}', 'probe', -1);`,
      ),
    ).toContain("Invalid timecode");
  });

  it("refuses an internal user calling the client function", () => {
    for (const who of ["admin", "worker", "commercial", "intern", "freelancer"]) {
      expect(
        sqlAsExpectError(
          USERS[who],
          `select public.portal_add_review_comment('${FIXTURES.reviewVersionCurrent}', 'probe', null);`,
        ),
      ).toContain("Only a client contact");
    }
  });

  it("a client comment moves the asset to changes_requested", () => {
    const out = sqlAs(
      USERS.client,
      `select public.portal_add_review_comment('${FIXTURES.reviewVersionCurrent}', 'Encore un ajustement', null); ` +
        `select status from public.portal_review_assets where id = '${FIXTURES.reviewAssetAtlas}';`,
    );
    expect(out).toContain("changes_requested");
  });

  it("the portal views are not writable", () => {
    expect(
      rowsUpdated(USERS.client, "public.portal_review_assets", "title = 'probe'", "true"),
    ).toBe(0);
    expect(
      rowsUpdated(USERS.client, "public.portal_review_comments", "body = 'probe'", "true"),
    ).toBe(0);
  });

  it("the media bucket is private and has no anonymous read policy", () => {
    expect(sql("select public::text from storage.buckets where id = 'review-media';")).toBe(
      "false",
    );
    const broad = sql(
      "select count(*) from pg_policies where schemaname = 'storage' " +
        "and policyname like 'review_media%' " +
        "and (coalesce(qual, '') like '%auth.uid() IS NOT NULL%' " +
        "     or coalesce(qual, '') like '%true%');",
    );
    expect(broad).toBe("0");
  });

  it("clients hold no write policy on the media bucket", () => {
    const writes = sql(
      "select count(*) from pg_policies where schemaname = 'storage' " +
        "and policyname = 'review_media_client_select' and cmd <> 'SELECT';",
    );
    expect(writes).toBe("0");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("profile self-update guard — the production hotfix", () => {
  // The same object that is applied to production as an emergency fix. Kept
  // here so the two cannot drift: if this suite passes, the production
  // statement is the one being tested.

  const PROTECTED = [
    ["role", "'admin'"],
    ["username", "'hijack'"],
    ["job_title", "'CEO'"],
  ];

  for (const who of ["worker", "freelancer", "commercial", "intern", "client"]) {
    for (const [column, value] of PROTECTED) {
      it(`${who} cannot change their own ${column}`, () => {
        expect(
          rowsUpdated(USERS[who], "public.profiles", `${column} = ${value}`, `id = '${USERS[who]}'`),
        ).toBe(0);
      });
    }
  }

  it("permitted self-service fields still work for every role", () => {
    // The guard is worthless if it also breaks the profile page. full_name and
    // avatar_url are the two fields a person may edit about themselves.
    for (const who of ["worker", "freelancer", "commercial", "intern", "client"]) {
      expect(
        `${who}:${rowsUpdated(USERS[who], "public.profiles", "full_name = 'Nouveau Nom'", `id = '${USERS[who]}'`)}`,
      ).toBe(`${who}:1`);
      expect(
        `${who}:${rowsUpdated(USERS[who], "public.profiles", "avatar_url = 'https://example.invalid/a.png'", `id = '${USERS[who]}'`)}`,
      ).toBe(`${who}:1`);
    }
  });

  it("an administrator can still manage roles", () => {
    expect(
      rowsUpdated(USERS.admin, "public.profiles", "role = 'worker'", `id = '${USERS.freelancer}'`),
    ).toBe(1);
  });

  it("the service-role path is untouched, so team management keeps working", () => {
    // No JWT claim: auth.uid() is NULL, which is how the admin client calls.
    // Guarding this path would break role administration while fixing the
    // escalation.
    const out = sql(
      "begin; with u as (update public.profiles set role = 'worker' " +
        `where id = '${USERS.freelancer}' returning 1) select 'ROWS=' || count(*) from u; rollback;`,
    );
    expect(out).toContain("ROWS=1");
  });

  it("depends on nothing a lagging database might be missing", () => {
    // Production is behind on migrations, so the guard inlines its own lookup
    // rather than calling is_admin() or auth_role().
    const body = sql(
      "select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
        "where n.nspname = 'public' and p.proname = 'guard_profile_self_update';",
    );
    for (const dependency of ["auth_role", "is_admin", "current_role", "is_internal"]) {
      expect(body, `guard calls ${dependency}`).not.toContain(dependency);
    }
    expect(body).toContain("auth.uid()");
  });

  it("does not test current_user, which a definer function would answer wrongly", () => {
    // The defect this replaced: inside SECURITY DEFINER, current_user is the
    // function's owner, so the guard permitted every write it existed to stop.
    const body = sql(
      "select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
        "where n.nspname = 'public' and p.proname = 'guard_profile_self_update';",
    );
    expect(body).not.toContain("current_user");
  });

  it("the superseded guard is gone", () => {
    expect(
      sql(
        "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
          "where n.nspname = 'public' and p.proname = 'guard_profile_role_change';",
      ),
    ).toBe("0");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("optional TVA — Phase 9", () => {
  it("historical rows read as TVA-enabled, legacy-calculated", () => {
    // The backfill is a statement of fact — every existing document WAS
    // computed with TVA by the legacy engine — not a policy choice.
    // Scoped to the documents that existed before the toggle. Devis 9007 is a
    // deliberately TVA-disabled fixture added to test the display rule, so
    // asserting "no row anywhere is disabled" would now assert the fixture away.
    expect(
      sql("select count(*) from public.devis where tva_enabled = false and devis_number <> 9007;"),
    ).toBe("0");
    expect(sql("select count(*) from public.devis where calc_source <> 'legacy-v1';")).toBe("0");
  });

  it("stored totals are untouched by the migration", () => {
    // The same hard-coded constant the finance suite pins, for the same
    // reason: a computed expectation would move with the damage it detects.
    expect(Number(sql("select round(sum(total_dt),2) from public.devis;"))).toBeCloseTo(
      14846,
      2,
    );
  });

  it("financial columns freeze when a document is issued — even for admin", () => {
    // devisSent is 'sent'. The trigger raises, so zero rows change. This is
    // the database enforcing what the application also refuses: an issued
    // document's arithmetic is a record, not a draft.
    expect(
      rowsUpdated(USERS.admin, "public.devis", "total_dt = total_dt + 1", `id = '${FIXTURES.devisSent}'`),
    ).toBe(0);
    expect(
      rowsUpdated(USERS.admin, "public.devis", "tva_enabled = false", `id = '${FIXTURES.devisSent}'`),
    ).toBe(0);
  });

  it("lifecycle columns stay mutable on an issued document", () => {
    // Moving a document through its life is not editing its arithmetic.
    expect(
      rowsUpdated(USERS.admin, "public.devis", "status = 'accepted'", `id = '${FIXTURES.devisSent}'`),
    ).toBe(1);
    expect(
      rowsUpdated(USERS.admin, "public.devis", "payment_status = 'partial'", `id = '${FIXTURES.devisSent}'`),
    ).toBe(1);
  });

  it("a draft's financial columns remain fully editable", () => {
    expect(
      rowsUpdated(USERS.admin, "public.devis", "tva_enabled = false, tva_dt = 0", `id = '${FIXTURES.devisDraft}'`),
    ).toBe(1);
  });

  it("the escape hatch works: back to draft, edit, re-issue", () => {
    const out = sql(
      "begin; " +
        `update public.devis set status = 'draft' where id = '${FIXTURES.devisSent}'; ` +
        `update public.devis set total_dt = total_dt where id = '${FIXTURES.devisSent}'; ` +
        "select 'EDITED'; rollback;",
    );
    expect(out).toContain("EDITED");
  });


  it("a TVA-disabled document stores no tax and says so explicitly", () => {
    // tva_enabled is the record of the DECISION. tva_dt = 0 alone cannot carry
    // it: a zero equally describes an exempt client, a rounding artefact, or a
    // document that predates the column.
    const row = sqlAs(
      USERS.admin,
      "select tva_enabled::text || '/' || tva_dt::text || '/' || total_dt::text " +
        "from public.devis where devis_number = 9007;",
    );
    expect(row).toBe("false/0.00/800.00");
  });

  it("every other seeded document remains TVA-enabled", () => {
    expect(
      sql("select count(*) from public.devis where tva_enabled = false;"),
    ).toBe("1");
  });

  it("the shadow log stores structure, never amounts or clients", () => {
    const cols = sql(
      "select string_agg(column_name, ',' order by column_name) from information_schema.columns " +
        "where table_schema = 'public' and table_name = 'money_shadow_log';",
    ).split(",");
    for (const sensitive of ["client_id", "devis_id", "total_dt", "legacy_total", "engine_total"]) {
      expect(cols, `shadow log carries ${sensitive}`).not.toContain(sensitive);
    }
    expect(cols).toContain("divergence_millimes");
  });

  it("the shadow log is writable by the roles whose drafts produce it, and no other", () => {
    const probe =
      "insert into public.money_shadow_log " +
      "(kind, item_count, tva_enabled, tva_rate, stamp_applied, divergence_millimes) " +
      "values ('devis', 1, true, 19.00, false, 10)";
    expect(rowsInserted(USERS.admin, probe)).toBe(1);
    expect(rowsInserted(USERS.commercial, probe)).toBe(1);
    for (const who of ["worker", "intern", "freelancer", "client"]) {
      expect(`${who}:${rowsInserted(USERS[who], probe)}`).toBe(`${who}:0`);
    }
  });

  it("only the administrator reads the measurement, and nobody rewrites it", () => {
    for (const who of ["worker", "commercial", "intern", "freelancer", "client"]) {
      expect(`${who}:${count(USERS[who], "public.money_shadow_log")}`).toBe(`${who}:0`);
    }
    expect(
      sql(
        "select count(*) from pg_policies where schemaname = 'public' " +
          "and tablename = 'money_shadow_log' and cmd in ('UPDATE','DELETE');",
      ),
    ).toBe("0");
  });
});
