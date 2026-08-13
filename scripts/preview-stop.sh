#!/usr/bin/env bash
# `npm run preview:stop` — tears the preview down and PROVES it.
#
# Returns nonzero if anything is left behind: a listener, a container, or an
# ephemeral credential file. "Probably stopped" is not an acceptable result for
# a command whose entire job is to confirm the database is no longer exposed.
set -uo pipefail
REPO="${PREVIEW_REPO:-/root/AreenCUBs-Studio-staging}"
cd "$REPO" || { echo "[preview] repo not found: $REPO"; exit 1; }

say() { echo "[preview] $*"; }
FAILED=0

# ── 1. Application ──────────────────────────────────────────────────────────
# Kill by PID from the listening socket, never by pattern-matching process
# name: a pattern that appears in the invoking command line matches the
# invoking shell and kills it before the rest of the script runs. That defect
# once left ten containers running while the command reported nothing at all.
PIDS=$(ss -lntpH 'sport = :3000' 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
if [ -n "$PIDS" ]; then
  for p in $PIDS; do kill "$p" 2>/dev/null; done
  sleep 3
  PIDS=$(ss -lntpH 'sport = :3000' 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  for p in $PIDS; do kill -9 "$p" 2>/dev/null; done
  sleep 2
  say "application stopped"
else
  say "application was not running"
fi

# ── 2. Database ─────────────────────────────────────────────────────────────
npm run db:stop 2>&1 | sed 's/^/[preview] /' || FAILED=1

# ── 3. Ephemeral credentials ────────────────────────────────────────────────
node scripts/e2e-env.mjs --cleanup >/dev/null 2>&1 || true
rm -f "$REPO/.env.local" "$REPO/.supabase-status.tmp"
for f in .env.local .supabase-status.tmp; do
  if [ -e "$REPO/$f" ]; then say "STILL PRESENT: $f"; FAILED=1; fi
done
say "ephemeral credentials deleted"

# ── 4. Prove it ─────────────────────────────────────────────────────────────
RUNNING=$(docker ps -q 2>/dev/null | wc -l)
ALL=$(docker ps -aq 2>/dev/null | wc -l)
LISTENERS=$(ss -lntH 2>/dev/null | grep -cE ':(3000|5432[1-4])' || true)

say "containers running=$RUNNING all=$ALL   listeners=$LISTENERS"
[ "$RUNNING" -ne 0 ] && { say "FAIL: containers still running"; FAILED=1; }
[ "$ALL" -ne 0 ]     && { say "FAIL: containers still present"; FAILED=1; }
[ "$LISTENERS" -ne 0 ] && { say "FAIL: ports still listening"; FAILED=1; }

if [ "$FAILED" -ne 0 ]; then
  say "CLEANUP INCOMPLETE — do not assume the stack is closed"
  exit 1
fi
say "preview fully stopped and verified"
exit 0
