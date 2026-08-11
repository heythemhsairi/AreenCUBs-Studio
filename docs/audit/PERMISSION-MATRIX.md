# Permission matrix — six roles

Written **before** implementation, as the roadmap requires. This document is the
specification; the migrations, the server-side guards and the RLS tests all
implement it, and the tests cite it.

Two independent layers enforce every rule:

1. **Server-side authorization** — route and action guards in `src/lib/auth.ts`.
2. **Row Level Security** — policies in Postgres.

Neither is trusted alone. A hidden UI control is not a permission, and a passing
server guard is not a substitute for a policy. Anything a role must not reach is
denied at both layers.

## Legend

| Symbol | Meaning |
|---|---|
| **●** | Full access — read, create, update, delete |
| **◐** | Scoped read **and** write, limited to the rows the row-scope column defines |
| **○** | Scoped read only |
| **·** | Own row only (the acting user's own record) |
| **–** | No access. Fail closed: no policy grants it, and the server guard refuses |

Roles use their database enum names: `admin`, `commercial`, `worker`, `intern`,
`freelancer`, `client`.

---

## 1. The scope each role is measured against

Access is never inferred — not from an email domain, not from a name, not from
string similarity. Every scope below resolves through an explicit relationship
row.

| Role | Scope |
|---|---|
| `admin` | Everything. The only role with financial administration, user management and audit visibility. |
| `commercial` | Clients where `clients.created_by = me` **or** a `client_members` row grants me `commercial_owner`. Their draft quotes and invoices. Nothing else. |
| `worker` | Projects I own, am assigned to, or created; their tasks; the clients those projects belong to; clients I created. |
| `intern` | Tasks assigned to me; their projects; a reduced view of those clients. Strictly less than a worker. |
| `freelancer` | Tasks assigned to me only; their projects; a reduced view of those clients. |
| `client` | The organisation a `client_members` row links me to, with relation `client_contact`. Nothing internal, ever. |

**Fail closed.** A signed-in user with no `profiles` row, or with a role that no
policy names, reaches nothing. `public.auth_role()` returns `NULL` for them and
every predicate evaluates to false rather than true.

---

## 2. Core matrix

### Identity and access

| Resource | admin | commercial | worker | intern | freelancer | client |
|---|---|---|---|---|---|---|
| `profiles` — own | ● | · | · | · | · | · |
| `profiles` — internal directory | ● | ○ | ○ | – | – | – |
| `profiles` — role assignment | ● | – | – | – | – | – |
| `client_members` | ● | ◐ own clients | ○ linked | – | – | – |
| `audit_log` | ○ all | ○ own actions | ○ own actions | ○ own actions | ○ own actions | – |

The internal directory is name, username, avatar and role. It is never contact
detail, never performance data, and never visible to a client.

### Clients

| Resource | admin | commercial | worker | intern | freelancer | client |
|---|---|---|---|---|---|---|
| `clients` (full row, includes `notes`) | ● | ◐ own | ○ linked or created | – | – | – |
| `client_directory` (safe columns) | ○ | ○ own | ○ linked | ○ assigned | ○ assigned | – |
| Create a client | ● | ● | ● | – | – | – |
| Delete a client | ● | – | – | – | – | – |

`clients.notes` is internal commentary about a client. Row Level Security is
row-level, not column-level, so a role that must not read one column must not be
given the row. `client_directory` is the answer: a view exposing `id`, `name`,
`email` and `phone` and **not** `notes`, `matricule_fiscal` or `address`. Interns
and freelancers read that view and have no policy on the table at all.

### Delivery

| Resource | admin | commercial | worker | intern | freelancer | client |
|---|---|---|---|---|---|---|
| `projects` | ● | ○ own clients' | ◐ own/assigned/created | ○ assigned | ○ assigned | – |
| `project_assignees` | ● | – | ○ own projects | ○ own | ○ own | – |
| `tasks` | ● | – | ◐ own projects | ◐ assigned | ◐ assigned | – |
| `task_assignees` | ● | – | ○ own projects | ○ own | ○ own | – |
| `task_comments` | ● | – | ◐ own tasks | ◐ assigned | ◐ assigned | – |
| `task_files` | ● | – | ◐ own tasks | ◐ assigned | ◐ assigned | – |
| `task_activity` | ● | – | ○ own tasks | ○ assigned | ○ assigned | – |
| `task_templates`, `task_tag_catalog` | ● | – | ○ | ○ | ○ | – |

Interns and freelancers may change a task's own progress fields. They may not
reassign a task, move it to another project, or delete it.

### Finance

| Resource | admin | commercial | worker | intern | freelancer | client |
|---|---|---|---|---|---|---|
| `devis` (quotes and invoices) | ● | ◐ **drafts only**, own clients | – | – | – | – |
| `devis_items` | ● | ◐ via own drafts, delete included | – | – | – | – |
| `payments` | ● | – | – | – | – | – |
| `expenses` | ● | – | – | – | – | – |
| `services` (price catalog) | ● | ○ | ○ | – | – | – |
| Mark an invoice paid, refund, change global pricing | ● | – | – | – | – | – |

The commercial restriction is the sharpest rule in this document, so it is stated
exactly. A commercial user may insert a `devis` for one of their own clients with
`status = 'draft'`, and may update it **while it stays a draft**. They may not
move it out of draft, touch a row that is already out of draft, delete any row,
record a payment, or alter a historical document. Each of those is a separate
test.

`payment_status` is pinned to `'unpaid'` alongside `status`. Constraining only
`status` left the payment column free, and the first run of the suite proved a
commercial could mark their own draft **paid** — settling an invoice, the single
most consequential financial action in the application, from the one role
explicitly forbidden to do it.

Deleting a *line item* from an owned draft is permitted, and is the one deletion
a commercial may perform. Removing a line from a document that has never been
issued is editing that draft, not deleting a business record.

`settings` holds agency-wide configuration — brand details, invoice headers —
that the shell renders for every signed-in staff member. It is read by all
internal roles and by no client.

### Content OS

| Resource | admin | commercial | worker | intern | freelancer | client |
|---|---|---|---|---|---|---|
| `client_content_profiles` | ● | ○ own clients | ◐ | ○ assigned | – | – |
| `monthly_content_plans` | ● | ○ own clients | ◐ | ○ assigned | – | – |
| `content_items` | ● | ○ own clients | ◐ | ○ assigned | – | – |
| `social_posts` | ● | – | ◐ | ○ assigned | – | – |

Client portal access to content arrives in Phase 6 and is deliberately **not**
granted here. Until the portal exists with its own scoped surfaces, the `client`
role reaches no content table.

### Operations

| Resource | admin | commercial | worker | intern | freelancer | client |
|---|---|---|---|---|---|---|
| `settings` | ● | ○ | ○ | ○ | ○ | – |
| `notifications` | · | · | · | · | · | · |
| `time_entries`, `work_schedule` | ● | – | ◐ own | ◐ own | ◐ own | – |
| `admin_tasks` | ● | – | – | – | – | – |
| `priority_pins` | ● | – | ◐ own | ◐ own | ◐ own | – |
| `featured_employees` | ● | – | ○ | ○ | ○ | – |
| `app_updates`, `app_update_items` | ● | ○ | ○ | ○ | ○ | – |

---

## 3. What each role must never reach

Stated as prohibitions because these are what the tests assert, and a prohibition
is easier to test than a permission.

**commercial** — another commercial's clients; any client they neither created
nor were assigned; worker performance; agency finances; totals across clients;
payments; expenses; a quote or invoice that has left draft; deletion of anything.

**worker** — clients unconnected to their work; agency-level financial
administration; payments; expenses; role assignment; the audit log of other
users.

**intern** — everything a worker cannot reach, plus: finance in any form,
contracts, `clients.notes`, worker performance data, and any client or project
they are not assigned to.

**freelancer** — everything an intern cannot reach, plus: unassigned tasks, and
any client information beyond the reduced directory.

**client** — every internal table without exception. Internal notes, costs,
margins, worker identities, other clients, task boards, quotes, payments. A
client may not approve payments, refunds or contractual changes; the portal
offers no such control and no policy would permit it.

---

## 4. Two behaviour changes this introduces

Recorded plainly rather than shipped quietly, because both alter how the live
application behaves for existing users. Both are local-only until the production
rollout is approved.

**Workers lose blanket client and project access.** Today
`clients_worker_select` grants every worker read access to every client row, and
`projects_worker_rw` grants read *and write* on every project. The roadmap
specifies a worker reaches "assigned projects/tasks and the client information
those require; no unrelated client data". After this change a worker reaches
projects they own, are assigned to, or created, and the clients those belong to.
Creating new work is unaffected — a worker may still create a project or client
and is scoped to it by authorship.

**Freelancers lose the `clients.notes` column.** Today
`clients_freelancer_select_via_tasks` returns the whole row, internal notes
included. They now read `client_directory` instead.

Neither is a financial rule change; no stored amount or calculation is touched.

---

## 5. Three defects the first test run exposed

Recorded because each was live before this phase, and because each is the kind
of thing a permission matrix is written to catch.

**Any user could make themselves an administrator.** `profiles_update_self` has
allowed a user to update their own profile row since migration 0002, and `role`
is a column of that row. `update profiles set role = 'admin' where id =
auth.uid()` succeeded from every account. RLS decides which *rows* a statement
may touch and has no opinion on which *columns* change, so no policy could have
closed this; migration `…000005` adds a trigger.

It had a test, and the test could not fail. It performed the escalation, then
re-read the role "in a fresh transaction" and asserted it was unchanged — but the
impersonation helper always rolls back, so the re-read was guaranteed to show the
original value whether the write was denied or succeeded.

**A commercial could mark their own invoice paid.** Described above.

**The reduced client view was writable.** A single-table view with no aggregate
is auto-updatable in PostgreSQL, and this one runs as its owner. Supabase grants
ALL on objects in `public` to `authenticated` by default, so `UPDATE
client_directory SET name = …` rewrote `public.clients` for a freelancer holding
no policy on that table at all — a hole straight through the containment the view
exists to provide. Introduced by this phase, caught by this phase, closed with an
explicit `REVOKE`.

---

## 6. How this is tested

`scripts/db/role-matrix.dbtest.mjs` walks this document. For every role and every
resource it asserts **rows visible** and **rows affected** — never merely whether
a statement threw.

That distinction is the whole point. RLS denies a write by filtering the rows it
applies to, so a forbidden `UPDATE` succeeds and reports zero rows. A test asking
"did it throw?" passes while the data is wide open. Every write assertion here
counts rows.

Each test also runs under `set local role authenticated` inside a transaction
that is always rolled back, and the suite refuses to trust any result until it
has confirmed it is not running as a superuser — as `postgres`, RLS is bypassed
and every assertion would pass vacuously.
