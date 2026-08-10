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

After `db:start`, every endpoint must be loopback:

```bash
npm run db:status | grep -Ei 'http|postgresql'   # expect 127.0.0.1 only
```

> ### ⚠ UNRESOLVED — the stack is reachable from the LAN on Docker Desktop for Windows
>
> `db:status` advertises `127.0.0.1`, but Docker **publishes on `0.0.0.0`**. Measured on this machine while the stack was running:
>
> ```
> 192.168.1.11:54321 reachable = True     ← Supabase API
> 192.168.1.11:54322 reachable = True     ← PostgreSQL (postgres:postgres)
> ```
>
> A superuser PostgreSQL port, open to the local network. The seeded data is entirely synthetic, but that is still a foothold.
>
> #### The Docker daemon configuration does NOT fix this on Windows
>
> The following was applied to `%USERPROFILE%\.docker\daemon.json` and Docker Desktop restarted. **It is not sufficient.**
>
> ```jsonc
> {
>   "ip": "127.0.0.1",                       // default bridge only
>   "default-network-opts": {
>     "bridge": {
>       "com.docker.network.bridge.host_binding_ipv4": "127.0.0.1"
>     }
>   }
> }
> ```
>
> Measured results, Docker Desktop 29.6.2 / WSL 2 backend:
>
> | Mechanism | Outcome |
> |---|---|
> | `"ip"` alone | applies to the **default bridge only**. Supabase uses a user-defined bridge, so it never applied. |
> | `default-network-opts.bridge` | a newly created user-defined bridge came back with only `enable_ipv4` / `enable_ipv6` — the host-binding option **was not inherited**. |
> | `docker network create -o com.docker.network.bridge.host_binding_ipv4=127.0.0.1` | the option **was present** on the network, yet the published port still bound `0.0.0.0:55998`. **Ignored.** |
> | `docker run -p 127.0.0.1:55997:8025` | bound `127.0.0.1:55997` only. LAN probe `False`, loopback `True`. **This is the only mechanism that works.** |
>
> **Root cause:** on Docker Desktop for Windows, host port publishing is performed by Docker Desktop's Windows-side proxy, not by the Linux bridge. That proxy binds `0.0.0.0` unless the publish spec itself carries an explicit `HostIp`. The container's `HostConfig.PortBindings` showed `HostIp: ""` — nothing is *requesting* `0.0.0.0`; it is simply the platform default, and the network option cannot override it.
>
> The Supabase CLI owns the publish spec and `config.toml` has no bind-address setting, so there is currently **no supported way** to make `supabase start` publish on loopback under Docker Desktop for Windows.
>
> #### ✅ RESOLVED — run the stack inside WSL 2 instead
>
> The Docker Desktop daemon configuration was **reverted** (restored from backup, hash-verified) and the stack now runs on a native Docker Engine inside the Ubuntu WSL distribution. See §9. Isolation is proven, not assumed.
>
> The Windows Firewall route stays ruled out by management — recorded here only so the decision is not revisited by accident.

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

---

## 9. Running the stack inside WSL 2 (the isolated setup)

Docker Desktop cannot bind published ports to loopback on Windows (§3). The stack therefore runs on a native Docker Engine inside the Ubuntu WSL distribution, where the daemon's default binding **is** honoured. Isolation was measured, not assumed.

### Why this works when Docker Desktop did not

The decisive difference is visible in one field. Under **both** setups the container requests `HostIp: ""` — nothing ever asks for `0.0.0.0`:

| | `HostConfig.PortBindings` | Actual binding |
|---|---|---|
| Docker Desktop (Windows) | `{"HostIp":"","HostPort":"54322"}` | `0.0.0.0:54322` ❌ |
| Docker Engine (WSL 2) | `{"HostIp":"","HostPort":"54322"}` | `127.0.0.1:54322` ✅ |

Native Linux Docker applies the daemon's default binding when `HostIp` is empty. Docker Desktop's Windows-side proxy does not — it publishes on `0.0.0.0` regardless of any network option.

### One-time setup

```bash
# Inside Ubuntu, as root. Docker Engine CE — free and open source.
# Follow Docker's official Ubuntu procedure, then:
cat > /etc/docker/daemon.json <<'JSON'
{
  "ip": "127.0.0.1",
  "default-network-opts": {
    "bridge": { "com.docker.network.bridge.host_binding_ipv4": "127.0.0.1" }
  }
}
JSON
systemctl restart docker
```

The daemon listens on the **UNIX socket only**. No `hosts` entry is added, so the API is never exposed over TCP; `0.0.0.0:2375` is never configured.

The workspace is a **separate clone inside the Linux filesystem** (`~/AreenCUBs-Studio-staging`, ext4 — not a `/mnt/c` drvfs mount), cloned from the local Windows repository rather than any hosted source. It carries **no `.env*` file at all**, so `supabase start` generates its own local keys. `node_modules` is installed natively in Linux and never shared with Windows — without this, `npm` resolves through PATH interop to `/mnt/c/Program Files/nodejs/npm`.

### Daily use

```bash
wsl -d Ubuntu
cd ~/AreenCUBs-Studio-staging
npm run db:preflight && npm run db:start && npm run db:reset && npm run db:verify
```

### Measured isolation (2026-08-10)

Linux side — `docker ps`, `docker inspect`, `ss -lntp`:

```
supabase_db     127.0.0.1:54322->5432/tcp
supabase_kong   127.0.0.1:54321->8000/tcp
supabase_studio 127.0.0.1:54323->3000/tcp
supabase_inbucket 127.0.0.1:54324->8025/tcp

LISTEN 127.0.0.1:54321  docker-proxy
LISTEN 127.0.0.1:54322  docker-proxy
LISTEN 127.0.0.1:54323  docker-proxy
LISTEN 127.0.0.1:54324  docker-proxy

wildcard bindings: none          LINUX ISOLATION: PASS
```

Windows side — `Get-NetTCPConnection` and `Test-NetConnection`:

| Target | 54321 | 54322 | 54323 | 54324 |
|---|---|---|---|---|
| `127.0.0.1` (must succeed) | ✅ True | ✅ True | ✅ True | ✅ True |
| LAN `192.168.1.11` (must fail) | ✅ False | ✅ False | ✅ False | ✅ False |
| WSL VM `172.31.35.107` (must fail) | ✅ False | ✅ False | ✅ False | ✅ False |
| WSL gateway `172.31.32.1` (must fail) | ✅ False | ✅ False | ✅ False | ✅ False |

Windows listeners on those ports: `127.0.0.1` only. No `0.0.0.0`, no `[::]`.

### WSL networking mode

`.wslconfig` is **absent**, so WSL defaults apply: **NAT** networking and `localhostForwarding=true`. Nothing was changed. NAT was confirmed empirically — the VM's `eth0` is `172.31.35.107/20`, a different subnet from the Windows LAN address `192.168.1.11`. In **mirrored** mode the VM shares the host's interfaces, and a service bound to `127.0.0.1` inside the VM would become reachable on the host's LAN address. **Do not enable mirrored networking** — `npm run db:preflight` now fails if it is set.

### Operational note

WSL shuts the VM down when idle, which stops the containers and removes the Windows-side forwarding. This is observable as ports that answered a moment ago suddenly refusing. It is not a fault, and it is a *safe* default: when idle, nothing listens at all. Run any `wsl` command to bring it back; systemd restarts Docker and the containers.

### What preflight now detects

`npm run db:preflight` checks, in addition to the earlier prerequisites:

- **Docker flavour** — native engine vs Docker Desktop, warning that Desktop cannot enforce loopback publishing
- **Docker API not on TCP** — fails on any `tcp://` endpoint
- **WSL networking mode** — fails on `mirrored`
- **Published port bindings** — fails on any `0.0.0.0` / `[::]` binding on a running `supabase_*` container
- **LAN reachability** — dials the host's own non-loopback addresses and requires refusal

---

## 10. Stopping the stack reliably

`npm run db:stop` no longer shells straight to `supabase stop`. That command returns before the Docker daemon has finished tearing containers down, so a count taken immediately afterwards is a race — it once reported **9 containers** for a stack whose ports were already closed.

Stopping is now an operation with a settling period: issue the stop, then poll until containers *and* ports agree, with a bounded timeout.

| Outcome | Exit | Meaning |
|---|---|---|
| `already-stopped` | 0 | nothing running, nothing listening — safe to call repeatedly |
| `stopped` | 0 | 0 running, 0 stale, 0 listeners |
| `timeout` | 1 | containers still running after the budget |
| `docker-failed` | 1 | the daemon could not be queried |
| `ports-still-listening` | 1 | containers gone but a port is still bound |
| `stale-containers` | 1 | exited Supabase containers remain |

Properties worth knowing:

- **Idempotent** — repeated calls succeed without issuing a stop.
- **Never touches foreign containers** — only `^supabase_` names are considered, so an unrelated local Postgres is never stopped.
- **Removes stale containers** — exited ones are what cause `container name already in use` on the next start.
- **A non-zero `supabase stop` is not automatically fatal** — the settled state decides, since the CLI can exit non-zero on a degraded stack whose containers still go away.
- **Ports are checked independently** — containers gone but a port still bound reports failure, never success.

Logic lives in `scripts/lib/staging-lifecycle.mjs` (pure, dependency-injected) and is covered by 21 tests driven by a fake clock. `scripts/stop-staging.mjs` only supplies the Docker and socket adapters.

### Preflight refuses, it does not warn

`npm run db:preflight` **fails** — it does not warn — on any of:

- Docker Desktop on Windows (cannot bind published ports to loopback)
- WSL mirrored networking (the VM would share the host's interfaces)
- a `tcp://` Docker endpoint (API exposed over the network)
- any `0.0.0.0` / `[::]` binding on a running `supabase_*` container
- a successful probe against the host's own non-loopback address

The last check is empirical on purpose. Binding text alone was misleading on Docker Desktop: a network carrying `host_binding_ipv4=127.0.0.1` still answered on the LAN.
