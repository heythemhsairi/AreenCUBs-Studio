-- Supabase RLS policies are evaluated only after PostgreSQL's base relation
-- privileges allow the operation. Production has the standard grants on the
-- original tables, but tables created later have no grants at all. Pin the
-- expected Supabase privilege layer explicitly so fresh PostgreSQL 17 stacks
-- and the hosted project behave the same way.

begin;

do $$
declare
  relation record;
begin
  for relation in
    select format('%I.%I', schemaname, tablename) as qualified_name
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('grant all privileges on table %s to anon', relation.qualified_name);
    execute format('grant all privileges on table %s to authenticated', relation.qualified_name);
    execute format('grant all privileges on table %s to service_role', relation.qualified_name);
  end loop;
end
$$;

grant all privileges on all sequences in schema public to anon, authenticated, service_role;

-- Owner-run portal/directory views intentionally use their grant list as the
-- access boundary. Reassert read-only authenticated access and no anonymous
-- access after the base-table grant repair.
do $$
declare
  view_relation record;
begin
  for view_relation in
    select format('%I.%I', schemaname, viewname) as qualified_name
    from pg_views
    where schemaname = 'public'
      and (viewname like 'portal_%' or viewname = 'client_directory')
  loop
    execute format('revoke all privileges on table %s from public, anon, authenticated', view_relation.qualified_name);
    execute format('grant select on table %s to authenticated', view_relation.qualified_name);
  end loop;
end
$$;

commit;
