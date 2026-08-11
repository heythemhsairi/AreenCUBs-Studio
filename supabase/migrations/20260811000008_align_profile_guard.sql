-- Aligns the local profile guard with the emergency production hotfix.
--
-- `20260811000005` installed `guard_profile_role_change()`, which worked but
-- was shaped for the local schema. Preparing the production hotfix improved it
-- in three ways, and local must converge on the production object rather than
-- carrying a near-identical twin — otherwise the next person to read the schema
-- finds two guards with different names and has to work out which one is real.
--
-- The three improvements, all carried here:
--
-- 1. It depends on NOTHING beyond migration 0001. The old version called
--    `public.is_admin()` and `public.auth_role()`; `auth_role()` does not exist
--    in production, which is behind on migrations. This inlines the lookup, so
--    the same statement is correct whether a database sits at 0017 or at 0025.
--
-- 2. It detects the caller with `auth.uid()` instead of `current_user`.
--    `current_user` is the wrong instrument inside a SECURITY DEFINER function
--    — it becomes the function's OWNER, which is exactly why the first version
--    of this guard silently permitted every write it existed to stop.
--    `auth.uid()` reads a GUC and is unaffected by whose privileges are in
--    force, so the guard can take definer rights and still see who is calling.
--
-- 3. It protects more than `role`. `username` is the sign-in identity —
--    usernameToEmail() maps it to the account's email, so changing it changes
--    who you log in as — and `job_title` is set only by an administrator.
--    `full_name` and `avatar_url` stay writable, because those are the two
--    fields the profile page lets a person edit about themselves.
--
-- Verified on a production-shaped replica (migrations 0001-0017 only) by
-- scripts/verify-hotfix-prodshape.sh, which reproduces the vulnerability, applies
-- this exact SQL, runs the validation matrix and rehearses the rollback.
--
-- The task-scope guard from 20260811000005 is untouched.

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
  -- A NULL auth.uid() is not an end-user session: the service-role client, a
  -- migration, or a dashboard query. Those have already passed a stronger
  -- boundary — a server-side key that never reaches a browser — and the
  -- application's own role administration runs through exactly that path.
  if caller is null then
    return new;
  end if;

  select p.role::text into caller_role
    from public.profiles p
   where p.id = caller;

  if caller_role = 'admin' then
    return new;
  end if;

  if new.role      is distinct from old.role
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

-- The superseded function. Dropped only after the trigger above has been
-- repointed, so there is no window in which profiles has no guard.
drop function if exists public.guard_profile_role_change();

commit;
