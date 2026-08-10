# Local staging environment

Free, isolated, runs entirely on your machine. **No production data is ever copied into it.**

---

## 1. CRITICAL — rotate the exposed service-role key first

A `service_role` key was pasted into a chat transcript. That key **bypasses every RLS policy** and can read, modify or delete any row in the production database. Treat it as fully compromised. Rotate it before anything else.

> **Never paste the replacement key into a chat, an issue, a commit, or a screenshot.**

### Procedure

1. **Rotate**
   Supabase Dashboard → your project → **Settings → API → Project API keys** → **Reset** the `service_role` key. Copy the new value directly from the dashboard.

2. **Update the production environment**
   Vercel → Project → **Settings → Environment Variables** → edit `SUPABASE_SERVICE_ROLE_KEY` → paste → save. Set it for Production (and Preview if used). Vercel masks the value after saving.

3. **Redeploy**
   Environment variables are read at build/boot. Vercel → **Deployments** → latest → **Redeploy**. Until this runs, the old key is still in the deployed environment.

4. **Verify the old key is dead**
   From a terminal, using the **old** key — expect `401`:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' \
     -H "apikey: <OLD_KEY>" \
     "https://<project-ref>.supabase.co/rest/v1/clients?select=id&limit=1"
   ```
   `401` means it is revoked. `200` means rotation has not taken effect — stop and investigate.

5. **Remove production credentials from developer machines**
   ```bash
   rm .env.local          # then recreate it pointing at LOCAL staging (§3)
   ```
   Production keys should not sit on a workstation. Local development uses the local stack.

6. **Consider also rotating the `anon` key.** It was exposed in the same message. It is far less dangerous — it is designed to be public and is constrained by RLS — but rotating it costs little. Note that rotating it requires updating `NEXT_PUBLIC_SUPABASE_ANON_KEY` everywhere and redeploying.

7. **Check for misuse.** Supabase Dashboard → **Logs** → API/Postgres. Look for unfamiliar IPs or unexpected bulk reads between the moment of exposure and the rotation.

### Why this matters more than a normal key

`anon` is gated by RLS. `service_role` is not — it is explicitly documented as bypassing RLS entirely. Anyone holding it has full read/write access to every client record, invoice and payment in the database, regardless of how good the policies are.

---

## 2. Prerequisites — one-time, free

The local Supabase stack runs in containers. This machine currently has **no container runtime**.

| Component | Status | Needed |
|---|---|---|
| Firmware virtualization | ✅ **Enabled** | — |
| CPU / RAM | ✅ 12 cores / 24 GB | — |
| WSL 2 | ❌ Not installed | `wsl --install` |
| Docker Desktop | ❌ Not installed | free download |
| Supabase CLI | ✅ Installed (devDependency) | — |

The hardware is ready. Only software is missing.

### Install (administrator PowerShell, one reboot)

```powershell
wsl --install
# reboot when prompted
```

Then install **Docker Desktop for Windows** from <https://www.docker.com/products/docker-desktop/> and start it once.

> **Licensing:** Docker Desktop is free for personal use, education, open source, and **small businesses under 250 employees and under $10M annual revenue**. Areen CUBs qualifies. No subscription is required.

Confirm everything at once:
```bash
npm run db:preflight
```

It checks WSL 2, the Docker daemon, the Supabase CLI, the project files and the four ports, then prints the exact remediation for anything missing — in installation order. It installs nothing, changes nothing and needs no elevation.

> **Why this cannot be done from an agent session:** `wsl --install` requires an elevated process, and this session runs unelevated as `DESKTOP-T61VSOV\AreenCubs` (`Get-WindowsOptionalFeature` returns *"The requested operation requires elevation"*). The install also requires a restart. Both are user actions.

### If Docker is not an option

A container-free fallback exists: a portable PostgreSQL install plus a small shim providing the `auth` schema and `auth.uid()` / `auth.role()`. It can test **migrations and RLS policies** — which is the main goal — but not PostgREST behaviour (so it cannot answer the schema-cache half of finding #1) and not Supabase Auth. Say the word and I will build it; it is not written yet, because the Docker path is strictly better and the prerequisite is a 10-minute install.

---

## 3. Start the stack

```bash
npm run db:preflight # confirm prerequisites (fails fast if anything is missing)
npm run db:start     # first run pulls images (~1 GB, a few minutes)
npm run db:reset     # applies all 25 migrations, then supabase/seed.sql
npm run db:verify    # asserts the environment is correct
```

### Confirming isolation

After `db:start`, every endpoint must be loopback. Anything else means the stack is not isolated:

```bash
npm run db:status | grep -Ei 'http|postgresql'   # expect 127.0.0.1 only
```

`npm run db:start` prints local URLs and keys. Put them in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key printed by db:start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key printed by db:start>
USERNAME_EMAIL_DOMAIN=areencubs.studio
```

These local keys are **fixed defaults, identical on every Supabase installation, and are not secrets**. They are still not committed, because `.env.local` is gitignored and keeping the rule simple avoids accidents.

| Service | URL |
|---|---|
| API (PostgREST) | http://127.0.0.1:54321 |
| Database | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Studio | http://127.0.0.1:54323 |
| Inbucket (captured mail) | http://127.0.0.1:54324 |

Then `npm run dev` and sign in.

### Daily commands

| Command | Effect |
|---|---|
| `npm run db:start` | start the stack |
| `npm run db:stop` | stop it (data survives) |
| `npm run db:reset` | **wipe**, re-apply migrations, re-seed |
| `npm run db:status` | show URLs and keys |
| `npm run db:verify` | run the verification checks |

---

## 4. Staging accounts

Created by `supabase/seed.sql`. Password for all: **`staging-only-not-a-secret`**.

| Username | Role | Purpose |
|---|---|---|
| `admin` | admin | full access |
| `worker` | worker | worker-scoped access |
| `freelancer` | freelancer | most restricted |
| `orphan` | *(no profile row)* | **must be denied** and routed to `/account-unavailable` |

The password is a fixture for a database that never leaves this machine and is destroyed by every reset. It is not a credential and must not be reused.

---

## 5. What the seed contains

**Every row is fabricated.** No client name, contact, project, invoice, amount or payment is copied from production. Company names are invented, addresses and tax numbers are structurally valid but meaningless, and amounts are round numbers chosen to make the audit findings reproducible.

The seed deliberately reproduces the confirmed findings so fixes can be verified in isolation:

| Finding | Fixture |
|---|---|
| #1 Content OS | profiles, plans and items exercised end to end |
| #3 Publishing | three posts still `scheduled` with dates in the past |
| #5 Finance | an invoice marked `paid` that is **1.00 DT short** — the exact contradiction |
| #5 Finance | a **draft** invoice marked paid; a **quote** carrying a payment status |
| #6 Projects | a `completed` project still holding two open tasks |
| #7 Projects | an `active` project whose deadline has passed |
| #18 Services | `Branding` and `branding` as separate categories |
| Phase 1d | an auth user with no profile row |

`npm run db:verify` asserts these fixtures are present, so a silent seed failure cannot be mistaken for a passing test run.

---

## 6. `db:push` is disabled on purpose

`npm run db:push` previously ran `supabase db push` against the **linked production project**. With staging available, that is a footgun sitting one keystroke away from `db:pull`. The script now refuses and explains itself.

Deploying migrations for real remains possible — `npx supabase db push`, run deliberately, and only with approval and a verified backup.

---

## 7. What this environment unblocks

Once running:

- **Finding #1** — determine whether the Content OS tables are genuinely missing or merely absent from the PostgREST schema cache. `db:verify` distinguishes the two.
- **Migration 21 idempotency** — re-run the migration against an already-migrated database and observe whether the unguarded `CREATE POLICY` block aborts. This is the evidence needed before writing the repair migration.
- **RLS testing** — exercise every policy as admin, worker, freelancer and orphan against real Postgres.
- **Finding #5** — build and test the financial state machine and constraints against the seeded contradictions.

**Production migration history is still required** (`supabase migration list` against the hosted project, connection string redacted) before any repair migration is written. Local staging tells us what *should* happen; only the remote history tells us what *did*.

---

## 8. Standing constraints

- Never copy production data into staging. If realistic volume is needed, extend the synthetic generator.
- Never point `.env.local` at production for day-to-day development.
- The money module stays disconnected from persistence until the one-centime divergence is approved (`docs/audit/MONEY-COMPATIBILITY.md` §4).
- No migration is applied to production without approval and a verified backup.
