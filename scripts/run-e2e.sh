#!/usr/bin/env bash
# Phase 2d runner — Linux/WSL only.
#
# Generates EPHEMERAL local Supabase credentials into an ignored .env.local
# inside the isolated clone, runs Playwright, then deletes the file — even if
# the tests fail.
#
# The keys are the Supabase CLI's fixed local development defaults. They are
# still never printed and never committed: keeping one rule ("no key leaves the
# machine") is safer than reasoning about which keys are harmless.
set -uo pipefail

REPO=/root/AreenCUBs-Studio-staging
cd "$REPO" || exit 1

ENV_FILE="$REPO/.env.local"

cleanup() {
  for f in "$ENV_FILE" "$REPO/.supabase-status.tmp"; do
    if [ -f "$f" ]; then
      shred -u "$f" 2>/dev/null || rm -f "$f"
      echo "[e2e] deleted $(basename "$f")"
    fi
  done
}
trap cleanup EXIT INT TERM

echo "[e2e] === ensure the stack is up ==="
# WSL shuts the VM down when idle, which stops the containers. Assuming the
# stack is still running from an earlier command is unreliable, so bring it up
# if it is not — otherwise `supabase status` returns nothing and the failure
# looks like a credential problem rather than a stopped stack.
if [ "$(docker ps -q 2>/dev/null | wc -l)" -eq 0 ]; then
  echo "[e2e] stack was down — starting"
  npm run db:start >/tmp/start.log 2>&1 || { echo "[e2e] db:start failed"; tail -20 /tmp/start.log; exit 1; }
  npm run db:reset >/tmp/reset.log 2>&1 || { echo "[e2e] db:reset failed"; tail -20 /tmp/reset.log; exit 1; }
  echo "[e2e] stack up, migrations + synthetic seed applied"
else
  echo "[e2e] stack already running ($(docker ps -q | wc -l) containers)"
fi

echo "[e2e] === isolation gate ==="
npm run db:preflight >/tmp/pf.log 2>&1
PF=$?
grep -E "FAIL|LAN reachability|Docker flavour|networking mode" /tmp/pf.log || true
if [ $PF -ne 0 ]; then
  echo "[e2e] REFUSING: preflight failed. See /tmp/pf.log"
  exit 1
fi

echo "[e2e] === generating ephemeral credentials (values never printed) ==="
# `supabase status -o env` emits shell assignments for the LOCAL stack only.
#
# Captured to a FILE rather than through $(...): under command substitution the
# CLI emitted only its update notice and no assignments. Redirecting to a file
# is deterministic. The local binary is used directly so npx resolution cannot
# introduce another variable.
STATUS_FILE="$REPO/.supabase-status.tmp"
./node_modules/.bin/supabase status -o env > "$STATUS_FILE" 2>/dev/null || true
if [ ! -s "$STATUS_FILE" ]; then
  ./node_modules/.bin/supabase status -o env > "$STATUS_FILE" 2>&1 || true
fi
if [ ! -s "$STATUS_FILE" ]; then
  echo "[e2e] could not read local stack status — is it running?"
  exit 1
fi
chmod 600 "$STATUS_FILE"

get() { grep -E "^$1=" "$STATUS_FILE" | head -1 | cut -d= -f2- | tr -d '"'; }

ANON=$(get ANON_KEY)
SERVICE=$(get SERVICE_ROLE_KEY)
API=$(get API_URL)

# Fallback: the `-o env` form has proved unreliable under redirection on this
# CLI version, so parse the default human-readable table instead. Its labels
# are "anon key:" / "service_role key:" / "API URL:".
if [ -z "$ANON" ] || [ -z "$SERVICE" ] || [ -z "$API" ]; then
  echo "[e2e] -o env yielded nothing usable; falling back to the default status table"
  ./node_modules/.bin/supabase status > "$STATUS_FILE" 2>&1 || true
  chmod 600 "$STATUS_FILE"
  # The table is box-drawn: "│ anon key │ <value> │". Normalise the borders to
  # pipes, then take the second field. Also tolerates a plain "label: value".
  pick() {
    sed 's/│/|/g' "$STATUS_FILE" \
      | grep -iE "\| *$1 *\|" \
      | head -1 \
      | awk -F'|' '{ gsub(/^[ \t]+|[ \t]+$/, "", $3); print $3 }'
  }
  pick_colon() { grep -iE "^[[:space:]]*$1[[:space:]]*:" "$STATUS_FILE" | head -1 | sed -E "s/^[^:]*:[[:space:]]*//" | tr -d '\r'; }
  [ -z "$ANON" ] && ANON=$(pick "anon key")
  [ -z "$SERVICE" ] && SERVICE=$(pick "service_role key")
  [ -z "$API" ] && API=$(pick "API URL")
fi

if [ -z "$ANON" ] || [ -z "$SERVICE" ] || [ -z "$API" ]; then
  echo "[e2e] could not obtain local credentials. Field names seen (values withheld):"
  sed -E 's/^([^:=]{1,40})[:=].*/  \1/' "$STATUS_FILE" | grep -E '^  \S' | head -20
  exit 1
fi

# The seeded synthetic accounts use @staging.local addresses, so the username
# domain must match for username-based sign-in to resolve.
{
  echo "NEXT_PUBLIC_SUPABASE_URL=$API"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON"
  echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE"
  echo "USERNAME_EMAIL_DOMAIN=staging.local"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "[e2e] wrote $ENV_FILE ($(wc -l < "$ENV_FILE") lines, values not shown)"

echo "[e2e] === production build (server will run TZ=UTC) ==="
npm run build >/tmp/build.log 2>&1 || { echo "[e2e] build failed"; tail -20 /tmp/build.log; exit 1; }
grep -E "Compiled successfully" /tmp/build.log || true

echo "[e2e] === playwright (browser timezone Africa/Tunis) ==="
npx playwright test "$@"
RESULT=$?

echo "[e2e] playwright exit=$RESULT"
exit $RESULT
