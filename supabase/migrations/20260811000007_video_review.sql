-- Phase 7 — video review.
--
-- A Frame.io-shaped loop, built on the membership model Phase 2 introduced:
-- the agency uploads a cut, the client watches it and leaves comments pinned
-- to a timecode, the agency resolves them and uploads the next version.
--
-- ── Three tables, and why each exists separately ────────────────────────────
--   review_assets    the thing being reviewed — one per deliverable, carrying
--                    the review status and the client it belongs to
--   review_versions  each upload. Versions are append-only rows rather than a
--                    mutated file path, so "what did the client actually see
--                    when they said that?" always has an answer
--   review_comments  pinned to a VERSION, not to the asset. A comment about
--                    the third cut must not silently reattach to the fourth
--
-- ── No public file URLs ─────────────────────────────────────────────────────
-- The bucket is private. Nothing here stores or returns a public URL; the
-- application issues short-lived signed URLs per request. A client reaches a
-- file only while their membership holds, and a leaked link expires.
--
-- Storage paths are `<client_id>/<asset_id>/<filename>`, and the storage
-- policy reads the first path segment back as the owning client. That is the
-- only way object-level scoping can work here: storage.objects has no foreign
-- key to our schema, so the path IS the relationship and it has to be
-- structured deliberately rather than by convention.

begin;

-- ═══ 1. Assets ═════════════════════════════════════════════════════════════
create table if not exists public.review_assets (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  title           text not null,
  status          text not null default 'in_review'
                  check (status in ('in_review', 'changes_requested', 'approved', 'archived')),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ═══ 2. Versions ═══════════════════════════════════════════════════════════
create table if not exists public.review_versions (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid not null references public.review_assets(id) on delete cascade,
  version_number   integer not null,
  storage_path     text not null,
  mime             text not null,
  size_bytes       bigint not null check (size_bytes > 0),
  duration_seconds numeric(10,2),
  uploaded_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (asset_id, version_number)
);

-- ═══ 3. Comments ═══════════════════════════════════════════════════════════
-- timecode_seconds NULL means a general comment about the whole version; a
-- value means it is pinned to a moment. One table for both, because they are
-- the same conversation and splitting them would make ordering them awkward.
create table if not exists public.review_comments (
  id               uuid primary key default gen_random_uuid(),
  version_id       uuid not null references public.review_versions(id) on delete cascade,
  author_id        uuid references public.profiles(id) on delete set null,
  author_side      text not null check (author_side in ('agency', 'client')),
  body             text not null check (length(trim(body)) > 0),
  timecode_seconds numeric(10,2) check (timecode_seconds >= 0),
  resolved_at      timestamptz,
  resolved_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists review_assets_client_idx    on public.review_assets (client_id);
create index if not exists review_versions_asset_idx   on public.review_versions (asset_id, version_number desc);
create index if not exists review_comments_version_idx on public.review_comments (version_id, created_at);

-- ═══ 4. Scope helpers ══════════════════════════════════════════════════════
create or replace function public.review_asset_client(asset uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select client_id from public.review_assets where id = asset
$$;

create or replace function public.review_version_client(version uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select a.client_id
  from public.review_versions v
  join public.review_assets a on a.id = v.asset_id
  where v.id = version
$$;

-- ═══ 5. Row Level Security ═════════════════════════════════════════════════
alter table public.review_assets   enable row level security;
alter table public.review_versions enable row level security;
alter table public.review_comments enable row level security;

-- Agency staff own the workflow: they create assets, upload versions, comment
-- and resolve. Commercial gets read-only visibility of their own clients'
-- reviews. Freelancer and intern get nothing here — review media is a client
-- deliverable, not a task attachment, and neither role has a reason to hold it.
drop policy if exists "review_assets_staff_all" on public.review_assets;
create policy "review_assets_staff_all" on public.review_assets
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "review_assets_commercial_select" on public.review_assets;
create policy "review_assets_commercial_select" on public.review_assets
  for select using (public.is_commercial() and public.commercial_owns_client(client_id));

drop policy if exists "review_versions_staff_all" on public.review_versions;
create policy "review_versions_staff_all" on public.review_versions
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "review_versions_commercial_select" on public.review_versions;
create policy "review_versions_commercial_select" on public.review_versions
  for select using (
    public.is_commercial()
    and public.commercial_owns_client(public.review_version_client(id))
  );

drop policy if exists "review_comments_staff_all" on public.review_comments;
create policy "review_comments_staff_all" on public.review_comments
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists "review_comments_commercial_select" on public.review_comments;
create policy "review_comments_commercial_select" on public.review_comments
  for select using (
    public.is_commercial()
    and public.commercial_owns_client(public.review_version_client(version_id))
  );

-- The client role deliberately gets NO policy on any of the three tables. It
-- reads the portal views below and writes through one function, exactly as in
-- Phase 6, so "a client reads zero rows from every internal table" stays a
-- true and testable statement.

-- ═══ 6. Portal surfaces ════════════════════════════════════════════════════
create or replace view public.portal_review_assets
  with (security_barrier = true) as
  select a.id, a.client_id, a.title, a.status, a.updated_at
  from public.review_assets a
  where public.client_contact_of(a.client_id)
    and a.status <> 'archived';

-- Only the latest version is offered. Earlier cuts are the agency's working
-- history; showing a client every abandoned attempt is not transparency, it is
-- noise, and it invites comments on a version nobody is working from.
create or replace view public.portal_review_versions
  with (security_barrier = true) as
  select v.id, v.asset_id, v.version_number, v.mime, v.size_bytes,
         v.duration_seconds, v.storage_path, v.created_at
  from public.review_versions v
  where public.client_contact_of(public.review_version_client(v.id))
    and v.version_number = (
      select max(v2.version_number) from public.review_versions v2 where v2.asset_id = v.asset_id
    );

create or replace view public.portal_review_comments
  with (security_barrier = true) as
  select c.id, c.version_id, c.author_side, c.body, c.timecode_seconds,
         c.resolved_at is not null as resolved, c.created_at
  from public.review_comments c
  where public.client_contact_of(public.review_version_client(c.version_id));

comment on view public.portal_review_comments is
  'Client-visible review conversation. author_side rather than author_id: a client sees that the agency replied, never which employee.';

revoke all on public.portal_review_assets   from public, anon, authenticated;
revoke all on public.portal_review_versions from public, anon, authenticated;
revoke all on public.portal_review_comments from public, anon, authenticated;
grant select on public.portal_review_assets   to authenticated;
grant select on public.portal_review_versions to authenticated;
grant select on public.portal_review_comments to authenticated;

-- ═══ 7. The client's write ═════════════════════════════════════════════════
create or replace function public.portal_add_review_comment(
  version_id       uuid,
  body             text,
  timecode_seconds numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owning_client uuid;
  new_id        uuid;
  latest        integer;
  this_version  integer;
begin
  if not public.is_client_user() then
    raise exception 'Only a client contact may comment here' using errcode = '42501';
  end if;

  if body is null or length(trim(body)) = 0 then
    raise exception 'A comment cannot be empty' using errcode = '22023';
  end if;
  if length(body) > 2000 then
    raise exception 'Comment too long' using errcode = '22023';
  end if;
  if timecode_seconds is not null and timecode_seconds < 0 then
    raise exception 'Invalid timecode' using errcode = '22023';
  end if;

  owning_client := public.review_version_client(version_id);

  -- Same error for "does not exist" and "not yours", so ids cannot be
  -- enumerated by watching which message comes back.
  if owning_client is null or not public.client_contact_of(owning_client) then
    raise exception 'Version not found' using errcode = '42501';
  end if;

  -- Comments only on the cut currently under review. Allowing them on a
  -- superseded version would produce feedback the team has already moved past.
  select v.version_number,
         (select max(v2.version_number) from public.review_versions v2 where v2.asset_id = v.asset_id)
    into this_version, latest
    from public.review_versions v
   where v.id = version_id;

  if this_version <> latest then
    raise exception 'This version has been superseded' using errcode = '22023';
  end if;

  insert into public.review_comments (version_id, author_id, author_side, body, timecode_seconds)
  values (version_id, auth.uid(), 'client', trim(body), timecode_seconds)
  returning id into new_id;

  update public.review_assets a
     set status = 'changes_requested', updated_at = now()
    from public.review_versions v
   where v.id = version_id and a.id = v.asset_id and a.status = 'in_review';

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, summary)
  values (auth.uid(), 'client', 'review.comment', 'review_version', version_id, null);

  return new_id;
end;
$$;

revoke all on function public.portal_add_review_comment(uuid, text, numeric) from public, anon;
grant execute on function public.portal_add_review_comment(uuid, text, numeric) to authenticated;

-- ═══ 8. Private bucket ═════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('review-media', 'review-media', false)
on conflict (id) do nothing;

-- Agency staff upload and manage.
drop policy if exists "review_media_staff_all" on storage.objects;
create policy "review_media_staff_all" on storage.objects
  for all using (bucket_id = 'review-media' and public.is_staff())
  with check (bucket_id = 'review-media' and public.is_staff());

-- A client reads only the objects filed under their own organisation's folder.
-- The first path segment is the client id; storage.foldername() reads it back.
-- Anything not shaped that way fails the uuid cast and is therefore denied,
-- which is the correct direction for a malformed path to fail.
drop policy if exists "review_media_client_select" on storage.objects;
create policy "review_media_client_select" on storage.objects
  for select using (
    bucket_id = 'review-media'
    and public.is_client_user()
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and public.client_contact_of(((storage.foldername(name))[1])::uuid)
  );

-- No INSERT, UPDATE or DELETE policy for clients: they watch and comment.

commit;
