# Session protocol — Areen CUBs Studio

This is a long-running, multi-session implementation program. A session should be able to start from the single word **"Continue."**

## On every session start

1. **Read, in order:**
   - `docs/audit/MASTER-IMPLEMENTATION-ROADMAP.md` — the standing brief and phase order
   - `docs/audit/SESSION-STATE.md` — where the previous session stopped
   - `docs/audit/DECISIONS-NEEDED.md` — what is approval-gated
2. **Verify** the branch is `phase-1-data-integrity`, HEAD matches the commit recorded in `SESSION-STATE.md`, and the tree is clean. If it does not match, stop and report the actual path, branch and status.
3. **Continue with the next unfinished phase automatically.** Do not ask for routine confirmation.
4. **Never repeat, revert or rewrite a completed phase.** Preserve unrelated work.

## While working

- One focused commit per phase, or per materially different fix. Never combine unrelated phases.
- Verify before committing: typecheck, unit tests, and whichever of the database / browser / axe suites the change touches.
- Do not send routine progress reports. Report when a phase completes, an approval is genuinely required, a security boundary fails, or a blocker survives three genuinely different approaches.
- If a task is approval-gated, record it in `DECISIONS-NEEDED.md` and continue with other safe work.
- **Continue into the following phase while context remains.**

## Before stopping

- Complete and verify the current commit. Never abandon an unverified partial edit.
- Update `docs/audit/SESSION-STATE.md` with the new HEAD, what finished, and an exact continuation point.
- Stop the local stack; confirm zero containers and zero listeners.
- Delete ephemeral credentials; run a secret scan; confirm a clean tree.

## Hard restrictions

- Free and open-source tools only. No payment, trial, subscription or billing method.
- **Never contact production** — no query, migration, migration-history command, repair, push, pull or dump.
- No Vercel change, deployment or production data modification.
- Never read, print, copy or modify the Windows production `.env.local`.
- Never expose or commit keys, JWTs, passwords, connection strings, environment files, machine configuration or generated credentials.
- Synthetic `.invalid` users and fabricated business data only.
- Do not accept licences or contractual terms on the owner's behalf.
- The full list is in the roadmap; the approval-gated items are in `DECISIONS-NEEDED.md`.

## Local environment

The database and browser tests run **only** inside the WSL clone at `~/AreenCUBs-Studio-staging`, on the native WSL Docker Engine. Docker Desktop is refused — it publishes on `0.0.0.0` regardless of any binding option. Sync the clone to the canonical commit before any database or end-to-end verification, and never share `node_modules` between Windows and WSL.

```bash
npm run preview:local    # isolation gate, synthetic DB, app on 127.0.0.1:3000
npm run preview:stop     # tears down and proves it; nonzero if incomplete
npm run test:run         # unit — no Docker needed
npm run test:db          # database/RLS — requires the WSL stack
npm run test:e2e         # Playwright + axe
```
