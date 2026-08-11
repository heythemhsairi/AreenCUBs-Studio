-- Phase 2 (addendum) — column-level guards that RLS structurally cannot give.
--
-- Row Level Security decides which ROWS a statement may touch. It has no
-- opinion about which COLUMNS of a permitted row may change. Two privileges in
-- this schema live in a column of a row the user is legitimately allowed to
-- edit, so no policy — however tightly written — can protect them.
--
-- Both were found by the Phase 2 role-matrix suite, which asserts rows
-- AFFECTED rather than whether a statement threw.
--
-- ═══ 1. Self-service role escalation ═══════════════════════════════════════
--
-- `profiles_update_self` has permitted a user to update their own profile row
-- since migration 0002, and `role` is a column of that row. So:
--
--     update public.profiles set role = 'admin' where id = auth.uid();
--
-- succeeded, from any account, for every role. One statement through PostgREST
-- with nothing but a normal signed-in session. This is a pre-existing defect,
-- not one introduced by the six-role model; widening the enum simply gave it
-- three more starting points.
--
-- It went unseen because the test that existed to catch it could not fail. It
-- performed the escalation, then re-read the role "in a fresh transaction" and
-- asserted it was unchanged — but the impersonation helper always rolls back,
-- so the re-read was guaranteed to show the original value whether the write
-- was denied or succeeded. The measurement has to happen inside the same
-- transaction; rows affected is the only honest signal. See
-- scripts/db/rls.dbtest.mjs, "no non-admin role can escalate its own profile".
--
-- ═══ 2. Reassigning yourself out of your own scope ═════════════════════════
--
-- An intern or freelancer may update the tasks assigned to them. `assignee_id`
-- and `project_id` are columns of those tasks. The policy's WITH CHECK calls
-- assigned_to_task(), which reads committed state and the multi-assignee join
-- table, so it still answers "yes" for a row being reassigned away — the check
-- passes and the write lands.
--
-- Nothing catastrophic follows from it, but it is not what the matrix says:
-- these roles change a task's progress, not who owns it or which project it
-- belongs to.
--
-- ── Why triggers ────────────────────────────────────────────────────────────
-- Column-level GRANT is the other candidate and does not work here. Privileges
-- attach to the PostgreSQL role, and every application user shares
-- `authenticated`; revoking UPDATE(role) would remove it from administrators
-- too. The distinction being drawn is between APPLICATION roles, which only a
-- profiles lookup can resolve.
--
-- ── Why the current_user test ───────────────────────────────────────────────
-- Server actions that legitimately change a role run through the service-role
-- client, which bypasses RLS but NOT triggers. Without the exemption this
-- migration would break administration while fixing the escalation. Any caller
-- that is not `authenticated` has already passed a stronger boundary: it holds
-- a server-side key that never reaches the browser.
--
-- ── Why these two functions are NOT security definer ────────────────────────
-- Everything else in this schema is, so the exception needs stating. Inside a
-- SECURITY DEFINER function `current_user` is the function's OWNER, not the
-- caller — so `current_user = 'authenticated'` was false for every caller
-- including the ones being guarded, and both triggers silently did nothing.
-- They fired, evaluated, and permitted the write.
--
-- The suite caught it: the same four assertions still reported rows affected
-- after the triggers existed. A guard that cannot be observed to fire is
-- indistinguishable from one that is absent.
--
-- Invoker rights are also all these functions need. They read no table
-- directly; is_admin() and auth_role() are themselves SECURITY DEFINER, so the
-- profile lookup still succeeds regardless of the caller's own RLS.

begin;

create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and current_user = 'authenticated'
     and not public.is_admin() then
    raise exception 'Only an administrator may change a profile role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard
  before update on public.profiles
  for each row
  execute function public.guard_profile_role_change();

create or replace function public.guard_task_scope_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user = 'authenticated'
     and public.auth_role() in ('intern','freelancer')
     and (new.assignee_id is distinct from old.assignee_id
          or new.project_id is distinct from old.project_id) then
    raise exception 'This role may not change task assignment or project'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_scope_guard on public.tasks;
create trigger trg_tasks_scope_guard
  before update on public.tasks
  for each row
  execute function public.guard_task_scope_change();

commit;
