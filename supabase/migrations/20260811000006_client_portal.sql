-- Phase 6 — the client portal surface.
--
-- Phase 2 deliberately gave the `client` role nothing: every internal table
-- reads zero rows for it, and the role-matrix suite asserts exactly that. This
-- migration opens the first doors, and opens them as narrowly as the schema
-- allows.
--
-- ── Why views and a function, not table policies ────────────────────────────
-- Granting a client SELECT on `content_items` would hand over the whole row:
-- `assigned_to` (which employee is doing the work), `priority` and `deadline`
-- (internal scheduling), `visual_direction` (the internal brief), `created_by`,
-- `task_id`. RLS is row-level; there is no policy that returns a row with some
-- of its columns withheld.
--
-- So the portal reads owner-run views that project only safe columns, and
-- writes through one SECURITY DEFINER function that validates before it acts.
-- The client role keeps zero policies on every internal table, which means the
-- Phase 2 assertions stay true and stay meaningful.
--
-- ── What a client may never do here ─────────────────────────────────────────
-- Approve a payment, a refund or anything contractual. Move a content item
-- through the production workflow — `status` stays internal, and the function
-- refuses to touch it. See docs/audit/PERMISSION-MATRIX.md §3.

begin;

-- ═══ 1. Which content is a client allowed to see at all ════════════════════
--
-- Not everything belonging to their organisation. An item in 'idea',
-- 'copywriting', 'design', 'editing' or 'internal_review' is work in progress
-- and showing it would leak the agency's process — half-written captions, a
-- concept that gets dropped, a deadline that slips. A client sees an item once
-- it has been put in front of them, and after.
create or replace function public.portal_visible_status(item_status text)
returns boolean
language sql immutable
as $$
  select item_status in ('client_review', 'approved', 'scheduled', 'published')
$$;

comment on function public.portal_visible_status(text) is
  'True for the content-item statuses a client organisation may see. Internal production states are excluded.';

-- ═══ 2. Read surfaces ══════════════════════════════════════════════════════
-- Each carries its own membership filter, because an owner-run view IS the
-- security boundary — nothing outside it constrains what these return.

create or replace view public.portal_client_org
  with (security_barrier = true) as
  select c.id, c.name
  from public.clients c
  where public.client_contact_of(c.id);

comment on view public.portal_client_org is
  'The organisation the signed-in contact belongs to. Name only: no address, no fiscal number, no internal notes.';

create or replace view public.portal_content_plans
  with (security_barrier = true) as
  select p.id, p.client_id, p.month, p.year, p.theme, p.status
  from public.monthly_content_plans p
  where public.client_contact_of(p.client_id);

create or replace view public.portal_content_items
  with (security_barrier = true) as
  select
    i.id,
    i.plan_id,
    i.client_id,
    i.title,
    i.content_type,
    i.platform,
    i.caption,
    i.publish_date,
    i.status,
    i.approval_status,
    i.client_feedback,
    i.final_asset_url,
    i.updated_at
  from public.content_items i
  where public.client_contact_of(i.client_id)
    and public.portal_visible_status(i.status);

comment on view public.portal_content_items is
  'Client-visible content. Omits assigned_to, priority, deadline, visual_direction, pillar, created_by and task_id — every column that describes the agency rather than the deliverable.';

-- Supabase grants ALL on objects in `public` to `authenticated` by default,
-- and a single-table view with no aggregate is auto-updatable. Without these
-- revokes, `UPDATE portal_content_items SET ...` would write straight through
-- to content_items for a caller holding no policy on it. That exact hole was
-- found in client_directory during Phase 2 by a test that tried it.
revoke all on public.portal_client_org    from public, anon, authenticated;
revoke all on public.portal_content_plans from public, anon, authenticated;
revoke all on public.portal_content_items from public, anon, authenticated;
grant select on public.portal_client_org    to authenticated;
grant select on public.portal_content_plans to authenticated;
grant select on public.portal_content_items to authenticated;

-- ═══ 3. The single write a client may perform ══════════════════════════════
--
-- Approving a piece of content, or asking for a revision, with a comment.
-- Everything is validated here rather than trusted from the caller:
--
--   * the caller must hold the `client` role
--   * the item must belong to an organisation they are a contact of
--   * the item must actually be awaiting their review — approving something
--     already published, or something still in internal design, is refused
--   * the decision must be one of two values
--
-- `status` is never written. The production workflow belongs to the agency; a
-- client's approval records their decision and the team acts on it.
create or replace function public.portal_set_approval(
  item_id  uuid,
  decision text,
  feedback text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_client uuid;
  item_status   text;
  item_title    text;
begin
  if not public.is_client_user() then
    raise exception 'Only a client contact may record an approval'
      using errcode = '42501';
  end if;

  if decision not in ('approved', 'revision_requested') then
    raise exception 'Unknown decision' using errcode = '22023';
  end if;

  select i.client_id, i.status, i.title
    into target_client, item_status, item_title
    from public.content_items i
   where i.id = item_id;

  -- Deliberately the same error for "does not exist" and "not yours". A
  -- different message for each would let a client enumerate other
  -- organisations' item ids by watching which one comes back.
  if target_client is null or not public.client_contact_of(target_client) then
    raise exception 'Item not found' using errcode = '42501';
  end if;

  if item_status <> 'client_review' then
    raise exception 'This item is not awaiting your review' using errcode = '22023';
  end if;

  update public.content_items
     set approval_status = decision,
         client_feedback = coalesce(nullif(trim(feedback), ''), client_feedback),
         updated_at      = now()
   where id = item_id;

  -- Notify the internal owner. Falls back to the creator when nobody is
  -- assigned, and inserts nothing at all rather than failing the approval if
  -- neither is set — the client's decision is recorded either way.
  insert into public.notifications (user_id, kind, body, link)
  select
    coalesce(i.assigned_to, i.created_by),
    'content_approval',
    case when decision = 'approved'
         then 'Contenu approuvé par le client : ' || item_title
         else 'Révision demandée par le client : ' || item_title
    end,
    '/dashboard/content/items/' || item_id::text
  from public.content_items i
  where i.id = item_id
    and coalesce(i.assigned_to, i.created_by) is not null;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, summary)
  values (
    auth.uid(), 'client', 'content.' || decision, 'content_item', item_id,
    -- The title, not the feedback. An audit entry records that a decision
    -- happened; it is not a second copy of the content.
    item_title
  );
end;
$$;

revoke all on function public.portal_set_approval(uuid, text, text) from public, anon;
grant execute on function public.portal_set_approval(uuid, text, text) to authenticated;

-- The function inserts on behalf of the client, so the client role itself
-- still needs no INSERT policy on notifications or audit_log — SECURITY
-- DEFINER covers both, and neither table becomes reachable directly.

commit;
