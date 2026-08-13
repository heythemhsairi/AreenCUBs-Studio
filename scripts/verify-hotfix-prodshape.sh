#!/bin/bash
# Verifies the emergency profile-role hotfix against a PRODUCTION-SHAPED local
# database: migrations 0001-0017 only, which is what production has according to
# docs/audit/PHASE-0-DISCOVERY.md §3.1.1 (migration 0018 fails with 42601, so
# 0018-0025 never applied).
#
# Testing the hotfix on the full local schema would prove very little. The full
# schema has six roles, auth_role(), client_members and everything Phase 2 added
# — none of which exists in production. This replays the SQL against the schema
# it will actually meet.
#
# Everything is local. It never contacts production. It restores the migration
# directory and the seed on exit, including on failure.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

HELD=/tmp/heldback-migrations
SEED=supabase/seed.sql
SEED_BACKUP=/tmp/seed-original.sql
FAILURES=0

restore() {
  echo ""
  echo "── restoring the full local schema ──────────────────────────────────"
  [ -d "$HELD" ] && mv "$HELD"/*.sql supabase/migrations/ 2>/dev/null
  rmdir "$HELD" 2>/dev/null
  [ -f "$SEED_BACKUP" ] && mv "$SEED_BACKUP" "$SEED"
  npm run db:reset >/tmp/restore-reset.log 2>&1 \
    && echo "   full schema restored" \
    || { echo "   RESTORE FAILED — see /tmp/restore-reset.log"; exit 1; }
}
trap restore EXIT

C=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
[ -n "$C" ] || { echo "no local staging database"; exit 1; }
q() { docker exec "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tAc "$1" 2>&1; }

check() { # name expected actual
  if [ "$2" = "$3" ]; then
    echo "   PASS  $1"
  else
    echo "   FAIL  $1 — expected '$2', got '$3'"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "── building a production-shaped database (migrations <= 0017) ─────────"
mkdir -p "$HELD"
for f in supabase/migrations/*.sql; do
  base=$(basename "$f")
  # Everything from 20260624000018 onward is absent from production.
  if [[ "$base" > "20260604000017_zzz" ]]; then mv "$f" "$HELD/"; fi
done
echo "   held back $(ls "$HELD" | wc -l) migrations; $(ls supabase/migrations | wc -l) will apply"

cp "$SEED" "$SEED_BACKUP"
cat > "$SEED" <<'MINIMAL'
-- Minimal seed for the production-shaped replica. The real seed uses columns
-- added after migration 0017 and cannot apply here.
begin;
delete from auth.users where email like '%@staging.local';
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
select v.id::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
       'authenticated', 'authenticated', v.email,
       crypt('staging-only-not-a-secret', gen_salt('bf')),
       now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
       '', '', '', '', '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111', 'admin@staging.local'),
  ('22222222-2222-4222-8222-222222222222', 'worker@staging.local'),
  ('33333333-3333-4333-8333-333333333333', 'freelancer@staging.local')
) as v(id, email);

insert into auth.identities (provider_id, user_id, identity_data, provider,
                             last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u where u.email like '%@staging.local'
on conflict do nothing;

insert into public.profiles (id, username, full_name, role, job_title) values
  ('11111111-1111-4111-8111-111111111111', 'admin',      'Staging Admin',      'admin',      'Direction'),
  ('22222222-2222-4222-8222-222222222222', 'worker',     'Staging Worker',     'worker',     'Designer'),
  ('33333333-3333-4333-8333-333333333333', 'freelancer', 'Staging Freelancer', 'freelancer', 'Monteur')
on conflict (id) do update set role = excluded.role;
commit;
MINIMAL

npm run db:reset >/tmp/prodshape-reset.log 2>&1 || {
  echo "   db:reset FAILED — see /tmp/prodshape-reset.log"; exit 1; }

APPLIED=$(q "select max(version) from supabase_migrations.schema_migrations;")
echo "   newest applied migration: $APPLIED"
check "replica stops at 0017" "20260604000017" "$APPLIED"

echo ""
echo "── PRE-FLIGHT: the checks from section 1 of the hotfix ────────────────"
check "profiles_update_self exists" "1" \
  "$(q "select count(*) from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_self';")"
check "it restricts no column" "(auth.uid() = id)" \
  "$(q "select qual from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_self';")"
check "job_title column present" "1" \
  "$(q "select count(*) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='job_title';")"
check "no role guard already installed" "0" \
  "$(q "select count(*) from pg_trigger where tgrelid='public.profiles'::regclass and tgname='trg_profiles_role_guard';")"
check "is_admin() exists (dependency check)" "1" \
  "$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_admin';")"
check "auth_role() absent, as in production" "0" \
  "$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='auth_role';")"

BEFORE=$(q "select string_agg(role::text || '=' || n, ',' order by role::text) from (select role, count(*) n from public.profiles group by role) x;")
echo "   role distribution before: $BEFORE"

echo ""
echo "── the vulnerability, on the production-shaped schema ─────────────────"
ESCALATE="begin;
 select set_config('request.jwt.claims','{\"sub\":\"22222222-2222-4222-8222-222222222222\",\"role\":\"authenticated\"}',true);
 set local role authenticated;
 with u as (update public.profiles set role='admin' where id='22222222-2222-4222-8222-222222222222' returning 1)
 select 'ROWS=' || count(*) from u;
 rollback;"
OUT=$(q "$ESCALATE")
if echo "$OUT" | grep -q "ROWS=1"; then
  echo "   CONFIRMED  a worker promoted themselves to admin — 1 row changed"
else
  echo "   FAIL  could not reproduce the vulnerability: $OUT"
  FAILURES=$((FAILURES + 1))
fi

echo ""
echo "── applying the hotfix (section 2 of the hotfix file) ─────────────────"
docker exec -i "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q >/tmp/hotfix-apply.log 2>&1 <<'FIX'
begin;
create or replace function public.guard_profile_self_update()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  caller uuid := auth.uid();
  caller_role text;
begin
  if caller is null then return new; end if;
  select p.role::text into caller_role from public.profiles p where p.id = caller;
  if caller_role = 'admin' then return new; end if;
  if new.role is distinct from old.role
     or new.username is distinct from old.username
     or new.job_title is distinct from old.job_title
     or new.id is distinct from old.id then
    raise exception 'Only an administrator may change role, username, job title or id'
      using errcode = '42501';
  end if;
  return new;
end;
$fn$;
drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard before update on public.profiles
  for each row execute function public.guard_profile_self_update();
commit;
FIX
if [ $? -eq 0 ]; then echo "   applied"; else
  echo "   FAIL  hotfix did not apply — see /tmp/hotfix-apply.log"; FAILURES=$((FAILURES + 1)); fi

echo ""
echo "── VALIDATION ────────────────────────────────────────────────────────"

as_user() { # uuid sql
  q "begin;
     select set_config('request.jwt.claims','{\"sub\":\"$1\",\"role\":\"authenticated\"}',true);
     set local role authenticated;
     $2
     rollback;"
}
rows_changed() { echo "$1" | grep -o 'ROWS=[0-9]*' | head -1 | cut -d= -f2; }

for who in 22222222-2222-4222-8222-222222222222 33333333-3333-4333-8333-333333333333; do
  R=$(as_user "$who" "with u as (update public.profiles set role='admin' where id='$who' returning 1) select 'ROWS=' || count(*) from u;")
  N=$(rows_changed "$R"); [ -z "$N" ] && N=0
  check "self-promotion denied for ${who:0:8}" "0" "$N"
done

R=$(as_user 22222222-2222-4222-8222-222222222222 "with u as (update public.profiles set username='hijack' where id='22222222-2222-4222-8222-222222222222' returning 1) select 'ROWS=' || count(*) from u;")
N=$(rows_changed "$R"); [ -z "$N" ] && N=0
check "username change denied" "0" "$N"

R=$(as_user 22222222-2222-4222-8222-222222222222 "with u as (update public.profiles set job_title='CEO' where id='22222222-2222-4222-8222-222222222222' returning 1) select 'ROWS=' || count(*) from u;")
N=$(rows_changed "$R"); [ -z "$N" ] && N=0
check "job_title change denied" "0" "$N"

R=$(as_user 22222222-2222-4222-8222-222222222222 "with u as (update public.profiles set full_name='Nouveau Nom' where id='22222222-2222-4222-8222-222222222222' returning 1) select 'ROWS=' || count(*) from u;")
check "permitted field full_name still writable" "1" "$(rows_changed "$R")"

R=$(as_user 22222222-2222-4222-8222-222222222222 "with u as (update public.profiles set avatar_url='https://example.invalid/a.png' where id='22222222-2222-4222-8222-222222222222' returning 1) select 'ROWS=' || count(*) from u;")
check "permitted field avatar_url still writable" "1" "$(rows_changed "$R")"

R=$(as_user 11111111-1111-4111-8111-111111111111 "with u as (update public.profiles set role='worker' where id='33333333-3333-4333-8333-333333333333' returning 1) select 'ROWS=' || count(*) from u;")
check "administrator can still manage roles" "1" "$(rows_changed "$R")"

R=$(q "begin; with u as (update public.profiles set role='worker' where id='33333333-3333-4333-8333-333333333333' returning 1) select 'ROWS=' || count(*) from u; rollback;")
check "service-role path unaffected (no JWT claim)" "1" "$(rows_changed "$R")"

R=$(as_user 22222222-2222-4222-8222-222222222222 "select 'ROWS=' || count(*) from public.profiles;")
if [ "$(rows_changed "$R")" -ge 1 ] 2>/dev/null; then
  echo "   PASS  reads unaffected — the trigger fires on UPDATE only"
else
  echo "   FAIL  reads broken: $R"; FAILURES=$((FAILURES + 1))
fi

AFTER=$(q "select string_agg(role::text || '=' || n, ',' order by role::text) from (select role, count(*) n from public.profiles group by role) x;")
check "role distribution unchanged" "$BEFORE" "$AFTER"

echo ""
echo "── rollback rehearsal ────────────────────────────────────────────────"
q "begin; drop trigger if exists trg_profiles_role_guard on public.profiles; drop function if exists public.guard_profile_self_update(); commit;" >/dev/null
check "trigger removed" "0" \
  "$(q "select count(*) from pg_trigger where tgrelid='public.profiles'::regclass and tgname='trg_profiles_role_guard';")"
check "function removed" "0" \
  "$(q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_profile_self_update';")"
OUT=$(q "$ESCALATE")
if echo "$OUT" | grep -q "ROWS=1"; then
  echo "   PASS  the hole returns after rollback — the rollback is genuine"
else
  echo "   FAIL  rollback did not restore prior behaviour"; FAILURES=$((FAILURES + 1))
fi

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo "ALL CHECKS PASSED on the production-shaped schema."
else
  echo "$FAILURES CHECK(S) FAILED — do not apply to production."
fi
exit "$FAILURES"
