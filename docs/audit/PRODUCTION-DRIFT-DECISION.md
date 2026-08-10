# Production drift — decision tree

Prepared so the eventual production check is **short, read-only and safe**. Nothing here has been executed. No production repair migration exists.

---

## The prediction under test

Migration `20260624000018_operational_improvements.sql` contained `current_role()` unqualified. `current_role` is a reserved PostgreSQL keyword taking no parentheses, so the statement is a **syntax error** (`42601`), not a runtime failure. A syntax error is not conditional: the migration cannot have applied successfully in **any** environment.

Supabase applies migrations in order and halts on failure, so the expected production state is:

```
0001 .. 0017   applied
0018           FAILED  ← chain stops here
0019 .. 0025   never attempted
```

Content OS is `0021`. That is the predicted cause of finding #1 — **not** a Content OS defect.

**This is an inference until §1 confirms it.** Everything below branches on what the evidence actually shows.

---

## 1. The only command needed (read-only)

```bash
npx supabase migration list --linked
```

Read-only: it compares local migration files against the remote `supabase_migrations.schema_migrations` table. It writes nothing.

A guarded wrapper is prepared at `scripts/prod-migration-history.mjs`. It:

- refuses to run without `--i-have-approval`
- refuses any argument that is not `list`
- redacts the project ref and any URL/connection string from its output
- **is not executed in this phase**

If you would rather run it yourself, run the raw command and paste the output back **with the project ref redacted**.

Also useful, still read-only:

```sql
select version from supabase_migrations.schema_migrations order by version;
select to_regclass('public.monthly_content_plans');   -- null = absent
select to_regclass('public.app_updates');
select count(*) from pg_policies where tablename = 'content_items';
```

---

## 2. Outcome A — history ends at 0017

**Expected pattern:** remote list stops at `20260624000017`; `0018`–`0025` show as local-only.

**Confirming evidence:** `to_regclass('public.app_updates')` and `to_regclass('public.monthly_content_plans')` both return NULL.

**Meaning:** the prediction holds exactly. Production is missing eight migrations' worth of schema.

**Repair strategy — forward-only:**
1. Back up the production database and **verify the backup restores** into a scratch project before touching anything.
2. Apply `0018`–`0025` in order, from the corrected files, in a single transaction per migration.
3. `notify pgrst, 'reload schema';`
4. Re-run the read-only checks.

**Why this is safe here:** these migrations are additive — `CREATE TABLE IF NOT EXISTS`, new columns with defaults, new policies. `0025` is the only one that mutates existing rows, and it only realigns `total_dt` with components already stored. **It does not reconcile payments**, which is how the 1 DT contradiction (finding #5) arises. Treat `0025` as a separate, separately-approved step.

**Rollback:** restore the verified backup. Objects created by `0018`–`0024` can also be dropped individually, since nothing pre-existing depends on them.

**Verification:** the local `npm run test:db` suite (99 tests) encodes exactly what a correct post-migration schema looks like.

---

## 3. Outcome B — 0018 is recorded but its objects are absent

**Expected pattern:** `20260624000018` appears in the remote list, yet `to_regclass('public.app_updates')` is NULL.

**Meaning:** the migration was marked applied without its statements succeeding — most likely applied manually, or repaired by hand in the dashboard.

**This is the most dangerous outcome**, because the history lies. A normal `db push` will skip `0018` forever while its objects never exist.

**Repair strategy:**
1. Do **not** delete or edit history rows to "make it re-run". That is a destructive edit to the migration ledger.
2. Write a **new** forward-only migration (`2026xxxx_repair_operational_improvements.sql`) that creates the missing objects idempotently, guarded with existence checks — never bare `CREATE POLICY`, which cannot be retried (proven locally).
3. Apply, reload PostgREST, verify.

**Rollback:** the repair migration only adds objects; reverting means dropping exactly what it created.

---

## 4. Outcome C — some of 0019–0025 were applied manually

**Expected pattern:** gaps — e.g. `0021` present but `0019` absent — or objects existing without matching history rows.

**Meaning:** someone ran SQL in the dashboard. Schema and ledger have diverged independently.

**Repair strategy:**
1. Build a **per-object inventory** first: for each of the eight migrations, does every table, column, index, trigger and policy exist? Do not infer from the ledger.
2. Write one forward-only repair migration that creates only what is genuinely missing, every statement guarded.
3. Reconcile the ledger **after** the schema matches, never before.

**Rollback:** as Outcome B.

---

## 5. Outcome D — objects exist but history is inconsistent

**Expected pattern:** all objects present; the ledger disagrees about which migrations ran.

**Meaning:** schema is fine; only the bookkeeping is wrong. Lowest risk, but it will break the next deploy.

**Repair strategy:** a ledger-only reconciliation, applied **after** proving object-by-object that the schema already matches the corrected migrations. No DDL.

**Rollback:** restore the ledger rows from the backup.

---

## 6. Rules that apply to every outcome

- **Never rely on the corrected historical migrations to heal production.** `0003`, `0007` and `0018` were fixed for *fresh installs*. Migrations already recorded as applied do not re-run, and a migration recorded as **failed** will not re-run either. Repair must be a new, forward-only file.
- **Never bare `CREATE POLICY` in a repair.** Proven locally: re-running one is rejected with *"already exists"*, so a partial apply cannot self-heal. Use a `pg_policies` existence check, or a reviewed `DROP POLICY IF EXISTS` + recreate.
- **Back up first and verify the backup restores.** An unverified backup is not a rollback plan.
- **Reload PostgREST** (`notify pgrst, 'reload schema'`) after any DDL, or the tables will exist while the API still 404s — the other half of finding #1.
- **`0025` touches settled financial rows.** It gets its own approval, separate from the schema repair.

---

## 7. `.sql.plan` files

Non-executable drafts may be placed in `supabase/plans/*.sql.plan`. That extension is deliberate: the Supabase CLI only picks up `.sql` under `migrations/`, so a plan can never be applied by accident.

Validate one locally by pasting it into a rolled-back transaction:

```sql
begin;
  -- plan contents
rollback;
```

No plan file becomes a real migration until §1 confirms the production state.

---

## 8. Service-role key rotation checklist

Independent of everything above. **The key is still valid and still compromised.**

- [ ] Supabase → Settings → API → **Reset** `service_role`
- [ ] Vercel → Settings → Environment Variables → update `SUPABASE_SERVICE_ROLE_KEY` (Production, and Preview if used)
- [ ] **Redeploy** — env vars are read at build/boot; the old key stays live until this happens
- [ ] Verify the old key returns **401**:
      `curl -s -o /dev/null -w '%{http_code}\n' -H "apikey: <OLD>" "https://<ref>.supabase.co/rest/v1/clients?select=id&limit=1"`
- [ ] Verify sign-in still works and RLS still applies with the replacement
- [ ] Consider rotating `anon` too (lower risk — it is public by design and RLS-constrained)
- [ ] Review Supabase logs for unfamiliar access between exposure and rotation

**Never paste the replacement key into a chat, issue, commit or screenshot.** Validation scripts must take it from `process.env` and must never log it.
