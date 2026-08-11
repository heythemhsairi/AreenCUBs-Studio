-- Phase 2 (2 of 3) — explicit membership, scope predicates and the audit trail.
--
-- Implements the data-model rules in docs/audit/PERMISSION-MATRIX.md §1:
-- access is never inferred. Not from an email domain, not from a name, not from
-- string similarity. Every scope resolves through a relationship row that
-- someone deliberately created, and that row records who created it.
--
-- Forward-only. Nothing is dropped, renamed or rewritten; no existing row is
-- modified. The pre-existing helpers current_role() / is_admin() /
-- is_worker_or_admin() stay exactly as they are because ~30 applied policies
-- call them.

-- ═══ 1. auth_role() — the replacement for current_role() ════════════════════
--
-- Two deliberate differences from public.current_role().
--
-- The NAME. `current_role` is a reserved PostgreSQL keyword, spelled without
-- parentheses like `current_user`. Writing the bare `current_role()` is a
-- syntax error, 42601. That is not hypothetical here: it is the defect that
-- stopped migration 0018 and, with it, every migration from 0018 to 0025.
-- Qualifying it works, but it is a trap that has already cost this project
-- eight migrations. New code uses a name that cannot be mistaken for a keyword.
--
-- The RETURN TYPE: text, not user_role. Comparing an enum column against a
-- string literal in a policy binds that literal to the enum at parse time,
-- which fails with 55P04 whenever the value was added by a migration in the
-- same transaction. Returning text sidesteps the hazard entirely and lets
-- policies write `public.auth_role() in ('admin','worker')` without casts.
--
-- Returns NULL for a signed-in user with no profile. Every predicate below is
-- written so NULL means denied.
create or replace function public.auth_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid()
$$;

comment on function public.auth_role() is
  'Application role of the calling user as text, or NULL when no profile exists. Fail-closed replacement for public.current_role().';

-- ═══ 2. Role predicates ════════════════════════════════════════════════════
-- coalesce(..., false) everywhere: a missing profile must be denied, never
-- treated as an unknown that some later OR branch might rescue.

-- Any internal staff member. Deliberately excludes 'client' and anyone with no
-- profile. This is the predicate that contains the new client role: every
-- policy that used to say "any authenticated user" becomes this instead.
create or replace function public.is_internal()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('admin','worker','commercial','intern','freelancer'), false)
$$;

-- Core internal staff: the roles that run agency operations.
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.auth_role() in ('admin','worker'), false)
$$;

create or replace function public.is_commercial()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'commercial', false)
$$;

create or replace function public.is_client_user()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.auth_role() = 'client', false)
$$;

-- ═══ 3. Explicit client membership ═════════════════════════════════════════
--
-- One table carries both relationships the matrix needs:
--
--   commercial_owner — a commercial user assigned to a client. Separate from
--                      clients.created_by so a client can be handed over
--                      without rewriting its authorship.
--   client_contact   — a person from the client organisation who signs in to
--                      the portal. This is the ONLY thing that makes a
--                      'client' role user able to see anything at all.
--
-- relation is text + check rather than an enum: a small closed set, and a
-- check constraint avoids adding a second type whose values would face the
-- same transaction-visibility rule as user_role.
create table if not exists public.client_members (
  client_id  uuid not null references public.clients(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  relation   text not null check (relation in ('commercial_owner','client_contact')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (client_id, profile_id, relation)
);

comment on table public.client_members is
  'Explicit membership. The only source of client scope for commercial and client roles; access is never inferred from email domain or name.';

-- The assigned commercial owner, denormalised for listing and sorting. The
-- authoritative grant is still the client_members row; this column exists so a
-- pipeline view does not need a join to order by owner.
alter table public.clients
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

-- ═══ 4. Audit trail ════════════════════════════════════════════════════════
-- Required by the matrix for significant mutations. Append-only by policy:
-- migration 3 grants INSERT and SELECT and never UPDATE or DELETE, so an
-- entry cannot be edited or erased by anyone reaching the table through RLS.
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_role  text,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  summary     text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.audit_log is
  'Append-only record of significant mutations. Never stores credentials, tokens or full document contents.';

-- ═══ 5. Scope predicates ═══════════════════════════════════════════════════
-- Each answers one question for the calling user. Policies compose them
-- instead of repeating join logic, so a scope can be corrected in one place.

-- Commercial ownership: authored the client, or holds an explicit assignment.
create or replace function public.commercial_owns_client(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.id = cid and (c.created_by = auth.uid() or c.owner_id = auth.uid())
  ) or exists (
    select 1 from public.client_members m
    where m.client_id = cid
      and m.profile_id = auth.uid()
      and m.relation = 'commercial_owner'
  )
$$;

-- Portal membership: the caller is a contact of this client organisation.
create or replace function public.client_contact_of(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.client_members m
    where m.client_id = cid
      and m.profile_id = auth.uid()
      and m.relation = 'client_contact'
  )
$$;

-- Assigned to a project: owner, explicit assignee, or assigned to one of its
-- tasks. The task branch matters — a freelancer given a single task must be
-- able to see the project that task lives in, and nothing else.
create or replace function public.assigned_to_project(pid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid and p.owner_id = auth.uid()
  ) or exists (
    select 1 from public.project_assignees pa
    where pa.project_id = pid and pa.user_id = auth.uid()
  ) or exists (
    select 1 from public.tasks t
    where t.project_id = pid
      and (t.assignee_id = auth.uid()
           or exists (select 1 from public.task_assignees ta
                      where ta.task_id = t.id and ta.user_id = auth.uid()))
  )
$$;

-- Assigned to a task: primary assignee or a member of the multi-assignee set.
create or replace function public.assigned_to_task(tid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = tid and t.assignee_id = auth.uid()
  ) or exists (
    select 1 from public.task_assignees ta
    where ta.task_id = tid and ta.user_id = auth.uid()
  )
$$;

-- A worker's client scope: clients they created, plus clients of projects they
-- own, created work in, or are assigned to. Replaces blanket worker access to
-- every client row. See PERMISSION-MATRIX.md §4.
create or replace function public.worker_linked_to_client(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.id = cid and c.created_by = auth.uid()
  ) or exists (
    select 1 from public.projects p
    where p.client_id = cid
      and (p.owner_id = auth.uid()
           or exists (select 1 from public.project_assignees pa
                      where pa.project_id = p.id and pa.user_id = auth.uid())
           or exists (select 1 from public.tasks t
                      where t.project_id = p.id
                        and (t.assignee_id = auth.uid()
                             or t.created_by = auth.uid()
                             or exists (select 1 from public.task_assignees ta
                                        where ta.task_id = t.id and ta.user_id = auth.uid()))))
  )
$$;

-- Assignment-derived client scope for intern and freelancer: only clients
-- behind a project they are actually on.
create or replace function public.assigned_to_client(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.client_id = cid and public.assigned_to_project(p.id)
  )
$$;

-- ═══ 6. Reduced client view ════════════════════════════════════════════════
--
-- RLS is row-level. A role that must not read clients.notes must therefore not
-- be given the clients row at all — there is no policy that hides one column.
-- Interns and freelancers get this view instead and have no policy on the
-- table, so the internal notes, the fiscal registration number and the postal
-- address are unreachable for them by construction rather than by omission.
--
-- The view is intentionally NOT security_invoker: it runs as its owner and
-- carries its own scope filter, which is what lets it expose a safe subset of a
-- table the caller cannot select from. The filter is the security boundary, so
-- it repeats the role test rather than relying on any caller-side condition.
create or replace view public.client_directory
  with (security_barrier = true) as
  select c.id, c.name, c.email, c.phone
  from public.clients c
  where
    public.is_admin()
    or (public.auth_role() = 'worker'  and public.worker_linked_to_client(c.id))
    or (public.is_commercial()         and public.commercial_owns_client(c.id))
    or (public.auth_role() in ('intern','freelancer') and public.assigned_to_client(c.id));

comment on view public.client_directory is
  'Client rows reduced to safe columns (no notes, no matricule_fiscal, no address) and filtered to the caller''s scope. The read surface for intern and freelancer, who hold no policy on public.clients.';

-- A single-table view with no aggregate is AUTO-UPDATABLE in PostgreSQL, and
-- this one runs as its owner. Left with the default grants, `UPDATE
-- client_directory SET name = ...` would rewrite public.clients for a
-- freelancer who holds no policy on that table at all — the view would become
-- a hole straight through the containment it exists to provide. Measured, not
-- assumed: the role-matrix suite proved it writable before this revoke.
--
-- Supabase grants ALL on objects in `public` to `authenticated` by default, so
-- granting SELECT is not enough; the write privileges must be taken away
-- first. PUBLIC is revoked too, since privileges held there apply to every
-- role regardless of what is granted individually.
revoke all on public.client_directory from public, anon, authenticated;
grant select on public.client_directory to authenticated;

-- ═══ 7. Indexes for the policy joins ═══════════════════════════════════════
-- Every predicate above drives a policy, so each is evaluated per row scanned.
-- These cover the columns those predicates filter on.
create index if not exists client_members_profile_idx  on public.client_members (profile_id, relation);
create index if not exists client_members_client_idx   on public.client_members (client_id);
create index if not exists clients_created_by_idx      on public.clients (created_by);
create index if not exists clients_owner_idx           on public.clients (owner_id);
create index if not exists projects_client_idx         on public.projects (client_id);
create index if not exists projects_owner_idx          on public.projects (owner_id);
create index if not exists tasks_created_by_idx        on public.tasks (created_by);
create index if not exists audit_log_actor_idx         on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_entity_idx        on public.audit_log (entity_type, entity_id);
