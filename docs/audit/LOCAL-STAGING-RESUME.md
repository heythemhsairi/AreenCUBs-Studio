# Local staging — resume checklist

**Purpose:** this task spans a Windows restart. An agent session cannot survive a reboot, so everything needed to resume is recorded here.

> **Contains no secrets.** No keys, tokens, passwords or connection strings appear in this file, and none may be added to it.

---

## State at the point of interruption

| | |
|---|---|
| Worktree | `C:\Users\AreenCubs\AreenCUBs-Studio` |
| Branch | `phase-1-data-integrity` |
| Commit | `08b09c751b3d30d3212bd8f2b5c3a6b304a3603e` (`08b09c7`) |
| Tree | clean |
| Tests at this commit | 175 passing, 7 files |
| Build at this commit | clean, 52 routes |

Verify on resume:

```bash
cd /c/Users/AreenCubs/AreenCUBs-Studio
git rev-parse --abbrev-ref HEAD    # phase-1-data-integrity
git rev-parse --short HEAD         # 08b09c7 (or later)
git status --short                 # empty
```

---

## Why a restart is needed

`wsl --install` enables two Windows optional features — **Virtual Machine Platform** and **Windows Subsystem for Linux** — and installs the WSL 2 kernel. Windows cannot activate these features in a running session, so a restart is mandatory before WSL, and therefore Docker Desktop, will function.

Confirmed on this machine before starting:

- Firmware virtualization: **enabled** (no BIOS change needed)
- VM Monitor Mode Extensions: yes · SLAT: yes
- 12 logical cores, 24 GB RAM
- WSL: **not installed** · Docker: **not installed** · Postgres: absent
- Agent session elevation: **not elevated** — `wsl --install` was launched via a UAC-confirmed elevated process

---

## Remaining commands, in order

### Result of the elevated install (completed 2026-08-10 06:34, exit code 0)

| Component | State |
|---|---|
| WSL | **2.7.11.0 installed** |
| WSL kernel | 6.18.33.2-2 |
| `VirtualMachinePlatform` | **Enabled** |
| `Microsoft-Windows-Subsystem-Linux` (legacy feature) | Disabled — not required by WSL 2.7.x, which ships as a standalone package |
| Linux distribution | **none installed** — `--no-launch` staged WSL only |
| `CBS RebootPending` | **True** |

DISM reported: *"Changes will not be effective until the system is rebooted."*

### Stage A — after the restart

```powershell
wsl --version
wsl --status
```

Then install the distribution, which the staged install did not include:

```powershell
wsl --install -d Ubuntu --no-launch
wsl --list --verbose            # expect Ubuntu at VERSION 2
```

`--no-launch` avoids the interactive UNIX username/password prompt. Docker Desktop does not need a user distribution — it provisions its own `docker-desktop` WSL instance — so Ubuntu can stay unlaunched. Launching it later (`wsl -d Ubuntu`) will ask for a username; that is a user action.

If any distribution reports VERSION 1:
```powershell
wsl --set-default-version 2
```

### Stage B — Docker Desktop

1. Install Docker Desktop for Windows from the official source: <https://www.docker.com/products/docker-desktop/>
2. Start it once and wait for the engine to report running.
3. **Free tier only.** If any payment, billing method, paid subscription or trial activation is requested — **stop**. Docker Desktop is free for small businesses under 250 employees and under US$10M annual revenue; that determination belongs to Areen CUBs management, not to the agent.
4. Licence/terms acceptance, if prompted, is handled by the user — never accepted on their behalf.

```bash
docker --version
docker info --format '{{.ServerVersion}}'
```

### Stage C — staging stack

```bash
cd /c/Users/AreenCubs/AreenCUBs-Studio
npm run db:preflight     # every check must PASS before continuing
npm run db:start         # first run pulls ~1 GB of images
npm run db:reset         # applies 25 migrations, then supabase/seed.sql
npm run db:verify
npm run db:status
```

**Isolation gate.** Every endpoint reported by `db:status` must be `127.0.0.1` or `localhost`. If any command targets a hosted `*.supabase.co` domain, **stop immediately** and report.

### Stage D — regression gate

```bash
npm run typecheck
npm run test:run         # expect 175 passing
npm run build            # expect 52 routes
```

---

## What Stage C is expected to settle

**Audit finding #1 — Content OS cannot save profiles or monthly plans.**

Phase 0 established that the schema exists and is complete in `supabase/migrations/20260625000021_content_os.sql`, and inferred that it was never fully applied to production. That remains an *inference*. Local staging tests the first half of it:

- If `db:reset` applies all 25 migrations cleanly and `db:verify` finds the three Content OS tables with RLS enabled and the `content_items → monthly_content_plans` relationship intact, the migration is **sound**, and the production failure is a *delivery* problem — either the migration never ran there, or PostgREST's schema cache is stale.
- If `db:reset` fails, the migration itself is defective and the failure will be visible in its output.

Either way, `supabase migration list` against the **hosted** project is still required to confirm what actually happened in production. Local staging cannot answer that, and no repair migration should be written until it does.

---

## Standing restrictions across the restart

- Never read, print, copy or expose production credentials.
- Never run a production query or a remote migration. **Never** `npx supabase db push`.
- Do **not** delete or replace `.env.local` until the service-role key has been rotated, Vercel updated, redeployed, and the old key verified rejected (`401`). See `docs/STAGING.md` §1.
- Do not deploy the application.
- Keep the money module disconnected from persistence — the one-centime divergence remains unapproved.
- No persistent startup tasks or registry entries were created for this work; nothing needs cleaning up afterwards.

---

## Outstanding, independent of this work

1. **Rotate the exposed `service_role` key** — still the most urgent item, and it does not depend on Docker, WSL or the agent. It bypasses all RLS on live client and financial data.
2. **Production migration history** — `supabase migration list` against the hosted project, connection string redacted.
3. **Money divergence approval** — `docs/audit/MONEY-COMPATIBILITY.md` §4.
