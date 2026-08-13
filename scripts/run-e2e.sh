#!/usr/bin/env bash
# Phase 2d runner — Linux/WSL only.
#
# Brings the isolated stack up if needed, proves loopback isolation, provisions
# EPHEMERAL local credentials, runs Playwright, and deletes the credentials on
# every exit path — success, failure or interrupt.
#
# Credential handling is delegated to scripts/e2e-env.mjs, which calls the Linux
# Supabase binary directly with no shell and parses `-o json` in-process. Shell
# based extraction was tried and abandoned; see docs/audit/AUTONOMOUS-PROGRESS.md.
set -uo pipefail

REPO=/root/AreenCUBs-Studio-staging
cd "$REPO" || exit 1

# Belt and braces: a shell trap AND a Node cleanup path.
cleanup() {
  node scripts/e2e-env.mjs --cleanup 2>/dev/null || rm -f "$REPO/.env.local"
  rm -f "$REPO/.supabase-status.tmp"
}
trap cleanup EXIT INT TERM

echo "[e2e] === ensure the stack is up ==="
# WSL stops the VM when idle, taking the containers with it. Assuming the stack
# survived an earlier command is unreliable, and a stopped stack previously
# looked like a credential failure.
if [ "$(docker ps -q 2>/dev/null | wc -l)" -eq 0 ]; then
  echo "[e2e] stack was down — starting"
  npm run db:start >/tmp/e2e-start.log 2>&1 || { echo "[e2e] db:start failed"; tail -20 /tmp/e2e-start.log; exit 1; }
  npm run db:reset >/tmp/e2e-reset.log 2>&1 || { echo "[e2e] db:reset failed"; tail -20 /tmp/e2e-reset.log; exit 1; }
  echo "[e2e] stack up, migrations + synthetic seed applied"
else
  echo "[e2e] stack already running ($(docker ps -q | wc -l) containers)"
fi

# Containers can be "running" while still reporting health: starting. The CLI
# then refuses with "container is not ready: starting", which reads like a
# credential failure. This happens routinely after WSL resumes from idle and
# Docker restarts the stack, so readiness is waited for rather than assumed.
echo "[e2e] === wait for the database to report healthy ==="
DB_C=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
if [ -n "$DB_C" ]; then
  for _ in $(seq 1 60); do
    H=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$DB_C" 2>/dev/null)
    [ "$H" = "healthy" ] && break
    [ "$H" = "none" ] && break
    sleep 2
  done
  echo "[e2e] database health: ${H:-unknown}"
  if [ "${H:-}" != "healthy" ] && [ "${H:-}" != "none" ]; then
    echo "[e2e] database never became healthy — aborting"
    exit 1
  fi
fi

echo "[e2e] === isolation gate ==="
npm run db:preflight >/tmp/e2e-pf.log 2>&1
PF=$?
grep -E "Docker flavour|networking mode|LAN reachability|Published port|FAIL" /tmp/e2e-pf.log || true
if [ $PF -ne 0 ]; then
  echo "[e2e] REFUSING: preflight failed. See /tmp/e2e-pf.log"
  exit 1
fi

echo "[e2e] === ephemeral credentials (values never printed) ==="
node scripts/e2e-env.mjs --write "$@" || exit 1

echo "[e2e] === production build (server runs TZ=UTC) ==="
npm run build >/tmp/e2e-build.log 2>&1 || { echo "[e2e] build failed"; tail -25 /tmp/e2e-build.log; exit 1; }
grep -E "Compiled successfully" /tmp/e2e-build.log || true

echo "[e2e] === playwright (browser timezone Africa/Tunis) ==="
# Strip helper-only flags before handing the rest to Playwright.
PW_ARGS=()
for a in "$@"; do
  [ "$a" = "--with-service-role" ] && continue
  PW_ARGS+=("$a")
done
npx playwright test "${PW_ARGS[@]}"
RESULT=$?

echo "[e2e] playwright exit=$RESULT"
exit $RESULT
