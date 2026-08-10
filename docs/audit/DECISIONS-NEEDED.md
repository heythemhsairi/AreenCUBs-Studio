# Decisions needed

Everything blocked on approval. Nothing here has been executed.

---

## 1. Rotate the production `service_role` key — CRITICAL, unblocked by anything else

A `service_role` key was pasted into a chat transcript. It **bypasses every RLS policy** on live client and financial data. It is still valid.

Full procedure: `docs/STAGING.md` §1. Checklist: `docs/audit/PRODUCTION-DRIFT-DECISION.md`.

The step most often missed: **redeploy Vercel after updating the variable** — environment variables are read at build/boot, so the old key stays live until then. Verify the old key returns `401`.

**Nobody but you can do this.** It needs no Docker, no WSL, and no agent.

---

## 2. Read-only production migration history

Needed to confirm or refute the drift prediction from finding #1: migration `0018` cannot parse, so `0018`–`0025` should be absent from production.

Requires: `supabase migration list` against the hosted project, **connection string redacted**, output pasted back. A guarded read-only wrapper is prepared in `scripts/` but is **not executed** and refuses to run without an explicit approval flag.

Until this lands, every statement about production's schema is an inference — a well-supported one, but an inference.

---

## 3. Money divergence — one centime

`docs/audit/MONEY-COMPATIBILITY.md` §4. Adopting `src/lib/money` changes ~0.9% of *future* documents by one centime, always toward the mathematically correct value. Historical documents are never recomputed.

Needs the accountant's sign-off. Until then the module stays disconnected from persistence.

---

## 4. Production repair migration

Cannot be written responsibly until #2 lands. Outcome-by-outcome plans are in `docs/audit/PRODUCTION-DRIFT-DECISION.md`.

**A corrected historical migration must never be assumed to heal production.** Migrations already recorded as applied do not re-run. Repair must be forward-only.

---

## 5. Deployment, Vercel changes, production data

None attempted. Includes deleting, archiving or bulk-changing agency records, and the 1 DT reconciliation on already-settled invoices (finding #5), which touches real financial history and needs a verified backup first.

---

## 6. New roles and permissions

The brief describes commercial / intern / client-portal roles. The database has exactly three: `admin`, `worker`, `freelancer`. Implementing more requires an approved specification — inventing authorization boundaries would be worse than leaving the gap visible.

---

## 7. Paid or contractual services

None accepted. Docker Desktop was installed under its free tier and no licence terms were accepted on anyone's behalf. Docker Engine CE, Noto Sans Arabic (SIL OFL), Vitest and Playwright are all free/open-source.
