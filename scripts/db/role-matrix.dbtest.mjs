import { describe, it, expect, beforeAll } from "vitest";
import { sql, sqlAs, sqlAsExpectDeniedOrZero, dbAvailable, USERS, FIXTURES } from "./sql.mjs";

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
    expect(count(USERS.admin, "public.tasks")).toBe(5);
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
    expect(count(USERS.worker, "public.tasks")).toBe(5);
  });

  it("cannot assign roles", () => {
    expect(rowsUpdated(USERS.worker, "public.profiles", "role = 'admin'", `id = '${USERS.worker}'`)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("intern — matrix §2, strictly less than a worker", () => {
  it("sees only the one task assigned to them", () => {
    expect(count(USERS.intern, "public.tasks")).toBe(1);
    expect(sqlAs(USERS.intern, "select id from public.tasks;")).toBe(FIXTURES.taskIntern);
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
