#!/usr/bin/env bash
# `npm run preview:local` — safe local preview.
#
# Refuses to start unless the environment is provably isolated:
#   * native WSL Docker Engine (Docker Desktop is REFUSED — it publishes on
#     0.0.0.0 regardless of any binding option, measured and documented in
#     docs/STAGING.md §3)
#   * WSL NAT networking, never mirrored
#   * no wildcard bindings on any supabase_* container
#   * the host's own non-loopback addresses must REFUSE connections
#
# Prints the local URL and nothing else. No credential value is ever echoed.
set -uo pipefail
REPO="${PREVIEW_REPO:-/root/AreenCUBs-Studio-staging}"
cd "$REPO" || { echo "[preview] repo not found: $REPO"; exit 1; }

say() { echo "[preview] $*"; }

# ── 1. Database ─────────────────────────────────────────────────────────────
if [ "$(docker ps -q 2>/dev/null | wc -l)" -eq 0 ]; then
  say "starting synthetic Supabase stack"
  npm run db:start >/tmp/preview-start.log 2>&1 || { say "db:start failed"; tail -15 /tmp/preview-start.log; exit 1; }
  npm run db:reset >/tmp/preview-reset.log 2>&1 || { say "db:reset failed"; tail -15 /tmp/preview-reset.log; exit 1; }
  say "migrations applied, fabricated seed loaded"
else
  say "stack already running ($(docker ps -q | wc -l) containers)"
fi

# ── 2. Readiness — never query before the database reports healthy ──────────
DB_C=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
if [ -n "$DB_C" ]; then
  for _ in $(seq 1 60); do
    H=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$DB_C" 2>/dev/null)
    { [ "$H" = "healthy" ] || [ "$H" = "none" ]; } && break
    sleep 2
  done
  say "database health: ${H:-unknown}"
  { [ "${H:-}" = "healthy" ] || [ "${H:-}" = "none" ]; } || { say "database never became healthy"; exit 1; }
fi

# ── 3. Isolation gate — refuses Docker Desktop, mirrored WSL, LAN exposure ──
say "isolation gate"
npm run db:preflight >/tmp/preview-preflight.log 2>&1
if [ $? -ne 0 ]; then
  say "ISOLATION GATE FAILED — refusing to start the application"
  grep -E "FAIL" /tmp/preview-preflight.log || true
  npm run db:stop >/dev/null 2>&1
  exit 1
fi
grep -E "Docker flavour|networking mode|Published port|LAN reachability" /tmp/preview-preflight.log || true

# ── 4. Ephemeral credentials — written to an ignored 0600 file, never shown ─
node scripts/e2e-env.mjs --write || exit 1

# ── 5. Application ──────────────────────────────────────────────────────────
# Bound to 0.0.0.0 INSIDE the NAT'd VM so WSL's localhost relay forwards it to
# the Windows host. The VM is NAT'd, so this is still unreachable from the LAN;
# the preflight above proves that on every start.
say "starting Next.js (server TZ=UTC)"
say ""
say "    ➜  http://127.0.0.1:3000/dashboard"
say ""
say "    Synthetic logins (fabricated fixtures, local database only):"
say "      admin | worker | freelancer   password: staging-only-not-a-secret"
say "      orphan  — authenticated with NO profile; must be denied"
say ""
say "    Stop with:  npm run preview:stop"
say ""
exec env TZ=UTC npx next dev -H 0.0.0.0 -p 3000
