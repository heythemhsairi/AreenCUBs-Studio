# Production hotfix — applied and validated

Audit record. No credential, connection string, hostname, project reference or
personal data appears here or was handled in producing it.

## What was fixed

**Self-service administrator escalation.** `profiles_update_self` (migration
`20260506000002`) permitted a user to UPDATE their own `profiles` row, and
`role` is a column of that row. Any signed-in account could run
`update public.profiles set role = 'admin' where id = auth.uid()` through
PostgREST and become an administrator. No application control prevented it,
because the write never went through the application.

Row Level Security could not close it: RLS decides which *rows* a statement may
touch, not which *columns* may change. Column-level `GRANT` could not either —
privileges attach to the PostgreSQL role, and every application user shares
`authenticated`. The distinction being drawn is between *application* roles,
which only a profiles lookup resolves. Hence a trigger.

## How it was applied

Manually, through the Supabase dashboard SQL Editor, by the account owner.

**Not** via `supabase db push`, which was ruled out twice: it would have
executed every other pending migration, and it would have failed on
`20260624000018`, whose unqualified `current_role()` is a 42601 syntax error.
A push would have aborted partway with production in an unknown state.

Source: `docs/audit/HOTFIX-PROFILE-ROLE-ESCALATION.sql`, sha256
`918cc0c0dae0ab993e11e69f3d3f81161c24fdba61eea2cf23efff2694210854`, committed at
`353069c`.

## Objects created

| Object | Kind |
|---|---|
| `public.guard_profile_self_update()` | `SECURITY DEFINER` trigger function |
| `trg_profiles_role_guard` | `BEFORE UPDATE ... FOR EACH ROW` on `public.profiles` |

Protected columns: `role`, `username`, `job_title`, `id`. Deliberately left
writable: `full_name`, `avatar_url` — the two fields the profile page lets a
person edit about themselves.

Nothing else was created, altered or dropped. No row was updated, no policy
changed, no financial data touched.

## Validation, as reported by the operator

| Check | Result |
|---|---|
| `trg_profiles_role_guard` present | 1 |
| `guard_profile_self_update()` present | 1 |
| Non-admin self-promotion | denied |
| Permitted self-profile update | preserved |
| Administrator role management | preserved |
| Server administration path (service role) | preserved |
| Role totals after | admin 4, freelancer 2, worker 3 — unchanged |
| Validation transaction | rolled back |

The role totals matching before and after is the assertion that matters most:
the guard changed behaviour without changing data.

## Rollback, if it is ever needed

Prior state carried no trigger and no function of these names, so the rollback
removes both and leaves nothing behind. It changes no row and no policy.

```sql
begin;
drop trigger if exists trg_profiles_role_guard on public.profiles;
drop function if exists public.guard_profile_self_update();
commit;
```

Rehearsed locally before application: `scripts/verify-hotfix-prodshape.sh`
confirms the escalation returns after rollback, which proves the rollback
restores prior *behaviour* rather than merely running without error.

---

# The migration-history finding

**`supabase_migrations.schema_migrations` does not exist in production.**

This was discovered by pre-flight check 1e and it is the most important thing
learned in this exercise. It is recorded here rather than buried in a commit
message because it invalidates an assumption the whole rollout plan rested on.

## What it means

Production has **no migration ledger at all**. It was never managed by the
Supabase CLI. Its schema arrived by some other route — dashboard SQL, manual
scripts, or an earlier tool — and nothing on the server records what ran or when.

## What this overturns

`PHASE-0-DISCOVERY.md` §3.1.1 concluded that production sits at migration
`20260604000017`, inferred from migration `0018` failing with 42601. That
inference may still be right about the *schema*, but it can no longer be
confirmed from a ledger, because there is no ledger. **Production's schema state
is unknown and can only be established by inspecting the objects themselves.**

## What this makes dangerous

`supabase db push` is now categorically unusable, not merely constrained. With
no `schema_migrations` table the CLI treats **every** migration as unapplied and
would attempt all thirty-four from `20260506000001` onward against a database
that already has most of those objects. The first `create type user_role` would
fail with 42710, or a `create table` with 42P07, and the run would abort partway.

This is a stronger statement than the earlier one. Before, a push would have run
twenty-three pending migrations. Now it would try to rebuild the schema from
zero on top of itself.

## What it validates

Writing the hotfix to depend on nothing beyond migration `0001` — no
`is_admin()`, no `auth_role()`, no enum value added later — turned out to be
necessary rather than merely careful. Since production's exact state cannot be
confirmed, any statement that assumed a specific migration level would have been
a guess. This one was correct regardless.

## What needs to happen before any further production schema work

1. **Establish the real schema state by inspection**, not by inference: dump the
   list of tables, columns, policies, functions and triggers from production and
   diff it against the local schema at each migration level.
2. **Decide how production will be managed from here.** Either baseline it into
   the CLI's ledger (`supabase migration repair --status applied` for everything
   already present, which writes only to the ledger), or accept that production
   is managed by reviewed standalone statements and stop pretending otherwise.
3. **Only then** consider applying the Phase 2–7 migrations, and one at a time.

Until step 1 is done, treat every statement destined for production the way this
hotfix was treated: self-contained, dependency-free, rehearsed against a
production-shaped replica, and applied by hand with a prepared rollback.
