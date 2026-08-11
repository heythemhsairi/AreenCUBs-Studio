-- ═══════════════════════════════════════════════════════════════════════════
-- EMERGENCY PRODUCTION HOTFIX — self-service administrator escalation
--
-- Vulnerability: `profiles_update_self` (migration 20260506000002) permits a
-- user to UPDATE their own profiles row, and `role` is a column of that row.
-- So any signed-in account can run
--
--     update public.profiles set role = 'admin' where id = auth.uid();
--
-- through PostgREST with nothing but a normal session, and become an
-- administrator. No application control prevents it, because the write never
-- goes through the application.
--
-- Row Level Security cannot fix this. It decides which ROWS a statement may
-- touch, not which COLUMNS may change. Column-level GRANT cannot fix it either:
-- privileges attach to the PostgreSQL role, and every application user shares
-- `authenticated`, so revoking UPDATE(role) would remove it from administrators
-- too. The distinction being drawn is between APPLICATION roles, which only a
-- profiles lookup can resolve. Hence a trigger.
--
-- ── HOW TO APPLY ───────────────────────────────────────────────────────────
-- Paste section 2 into the Supabase dashboard SQL editor and run it.
--
-- Do NOT use `supabase db push`. Production is behind on migrations — see
-- docs/audit/PHASE-0-DISCOVERY.md §3.1.1 — so a push would attempt every
-- pending migration, including 20260624000018 which fails with 42601. That
-- would violate the "no other pending migration" constraint and abort.
--
-- ── DEPENDENCIES: NONE BEYOND MIGRATION 0001 ───────────────────────────────
-- Deliberately self-contained. It does NOT call public.is_admin(),
-- public.auth_role(), public.current_role() or any Phase 2 object, and it does
-- not reference the `commercial`, `intern` or `client` enum values. It touches
-- only `public.profiles` and `auth.uid()`, both present since the initial
-- schema. It therefore applies correctly whether production sits at migration
-- 0017, at 0025, or anywhere between — which matters, because the exact
-- production migration state has not been confirmed from production itself.
--
-- ── NON-DESTRUCTIVE ────────────────────────────────────────────────────────
-- Creates one function and one trigger. Updates no row, drops nothing, alters
-- no column, changes no policy and touches no financial data. Every existing
-- role and profile value is left exactly as it is.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ 1. PRE-FLIGHT — read-only. Run first; record the output. ══════════════

-- 1a. Confirm the vulnerable policy exists and is what we think it is.
select policyname, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles'
 order by policyname;
-- EXPECT: a row `profiles_update_self`, cmd = UPDATE, whose qual and
-- with_check are both `(auth.uid() = id)` — no column restriction anywhere.

-- 1b. Confirm the column set, so the guard names columns that exist.
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
 order by ordinal_position;
-- EXPECT: id, username, full_name, role, avatar_url, created_at, updated_at
--         and job_title (added by migration 20260506000008).
-- If `job_title` is ABSENT, remove it from the guard in section 2 before
-- running — a trigger referencing a missing column raises at UPDATE time.

-- 1c. Record any existing trigger on profiles, so the rollback restores the
--     real prior state rather than an assumed one.
select tgname, pg_get_triggerdef(oid) as definition
  from pg_trigger
 where tgrelid = 'public.profiles'::regclass and not tgisinternal
 order by tgname;
-- EXPECT: trg_profiles_updated (the updated_at trigger) and nothing named
-- trg_profiles_role_guard. If a role guard already exists, STOP and compare.

-- 1d. Record the role distribution BEFORE, to prove afterwards that nothing
--     changed. Counts only — no names, no emails.
select role::text as role, count(*) as accounts
  from public.profiles
 group by role
 order by role;

-- 1e. Confirm the migration history actually applied to production.
select version
  from supabase_migrations.schema_migrations
 order by version desc
 limit 10;
-- EXPECT (per PHASE-0-DISCOVERY §3.1.1): the newest is 20260604000017, because
-- 20260624000018 fails with 42601. If newer versions ARE present, the drift
-- analysis is wrong and should be revisited — but the hotfix below is still
-- correct either way, since it depends on nothing after 0001.


-- ═══ 2. THE FIX — the only statement that writes anything ══════════════════

begin;

create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
begin
  -- A NULL auth.uid() means this is not an end-user session: the service-role
  -- client, a migration, or a dashboard query. Those have already passed a
  -- stronger boundary than this trigger — they hold a server-side key that
  -- never reaches a browser — and the application's own administration runs
  -- through exactly that path. Guarding it would break role management while
  -- fixing the escalation.
  if caller is null then
    return new;
  end if;

  -- SECURITY DEFINER is safe here, and was chosen deliberately.
  --
  -- The earlier local version of this guard tested `current_user =
  -- 'authenticated'`, which is WRONG inside a definer function: current_user
  -- becomes the function's OWNER, so the test was false for every caller and
  -- the trigger silently permitted every write it existed to stop.
  --
  -- auth.uid() has no such problem. It reads request.jwt.claims, a GUC, which
  -- is session state and completely unaffected by whose privileges the
  -- function runs with. Definer rights then guarantee the lookup below
  -- succeeds regardless of what SELECT policy profiles carries.
  select p.role::text into caller_role
    from public.profiles p
   where p.id = caller;

  if caller_role = 'admin' then
    return new;
  end if;

  -- Protected columns. `full_name` and `avatar_url` are absent on purpose:
  -- those are the two fields the profile page lets a person edit about
  -- themselves, and they must keep working.
  --
  -- `role`       — the escalation itself.
  -- `username`   — the sign-in identity; usernameToEmail() maps it to the
  --                account's email address, so changing it changes who you
  --                log in as. The application never writes it after creation.
  -- `job_title`  — set only by an administrator through team management.
  -- `id`         — the primary key and the subject of every RLS predicate.
  if new.role     is distinct from old.role
     or new.username  is distinct from old.username
     or new.job_title is distinct from old.job_title
     or new.id        is distinct from old.id then
    raise exception
      'Only an administrator may change role, username, job title or id'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard
  before update on public.profiles
  for each row
  execute function public.guard_profile_self_update();

commit;


-- ═══ 3. ROLLBACK — if any validation fails, run this and stop ══════════════
--
-- Restores the exact prior state: before this hotfix there was no trigger of
-- this name and no function of this name (confirmed by pre-flight 1c). The
-- rollback therefore removes both and leaves nothing behind. It changes no
-- row and no policy.
--
--   begin;
--   drop trigger if exists trg_profiles_role_guard on public.profiles;
--   drop function if exists public.guard_profile_self_update();
--   commit;


-- ═══ 4. VALIDATION — run after section 2. Every statement is rolled back. ══
--
-- Each block impersonates a real account WITHOUT its password, by setting the
-- JWT claim the way PostgREST does, and rolls back unconditionally. Replace
-- <NON_ADMIN_UUID> and <ADMIN_UUID> with ids from your own profiles table.
--
-- The measurement is ROWS AFFECTED, never whether the statement threw. RLS
-- denies writes by filtering, so a forbidden UPDATE succeeds and reports zero;
-- the pre-existing test for this very vulnerability asked "did it throw?" and
-- therefore could not fail.

-- 4a. A non-admin cannot promote themselves. EXPECT: exception 42501.
-- begin;
--   select set_config('request.jwt.claims',
--     '{"sub":"<NON_ADMIN_UUID>","role":"authenticated"}', true);
--   set local role authenticated;
--   update public.profiles set role = 'admin' where id = '<NON_ADMIN_UUID>';
-- rollback;

-- 4b. A non-admin CAN still edit the fields they own. EXPECT: 1 row.
-- begin;
--   select set_config('request.jwt.claims',
--     '{"sub":"<NON_ADMIN_UUID>","role":"authenticated"}', true);
--   set local role authenticated;
--   with u as (update public.profiles set full_name = full_name
--              where id = '<NON_ADMIN_UUID>' returning 1)
--   select count(*) as rows_changed from u;
-- rollback;

-- 4c. An administrator can still manage roles. EXPECT: 1 row.
-- begin;
--   select set_config('request.jwt.claims',
--     '{"sub":"<ADMIN_UUID>","role":"authenticated"}', true);
--   set local role authenticated;
--   with u as (update public.profiles set role = role
--              where id = '<NON_ADMIN_UUID>' returning 1)
--   select count(*) as rows_changed from u;
-- rollback;

-- 4d. The service-role path is untouched, so team management keeps working.
--     EXPECT: 1 row. (No JWT claim set — this is how the admin client calls.)
-- begin;
--   with u as (update public.profiles set role = role
--              where id = '<NON_ADMIN_UUID>' returning 1)
--   select count(*) as rows_changed from u;
-- rollback;

-- 4e. Nothing changed. EXPECT: identical to pre-flight 1d.
-- select role::text as role, count(*) as accounts
--   from public.profiles group by role order by role;

-- 4f. Finally, sign in to the application as a normal user and as an
--     administrator, and open the dashboard. The trigger fires on UPDATE only,
--     so authentication and reads are unaffected — but confirm it, do not
--     assume it.
