# Independent audit — post-completion

Run after the implementation programme was recorded complete, as a fresh
evidence-based pass rather than a continuation. Canonical repo, branch
`phase-1-data-integrity`, starting from `c05479b`.

Nothing here was taken on trust from the earlier phases: every claim below is
either a defect reproduced before it was fixed, or a property measured against
the running database.

---

## Confirmed defects, fixed

### 1. The client portal had no error boundary — `d7b7bec`

A failure anywhere under `/portal` fell through to `src/app/error.tsx`, which
renders `error.message` and `error.digest` verbatim in a `<pre>` block. That
page is written for agency staff, where raw detail is a diagnostic; the
portal's audience is an external client contact.

React scrubs server-component messages in a production build, so the exposure
is bounded — but client components and server actions are not scrubbed the same
way, and a digest is a correlation handle nobody outside the agency should
hold.

**Evidence:** `find src/app -name "error.tsx"` returned only the root and
dashboard boundaries; `/portal` had none. The new test fails (3 assertions)
with the boundary file moved aside and passes with it present.

### 2. A commercial was offered a media control that ejected them — `ee6702a`

`/dashboard/review` admits admin, worker and commercial. The detail page gated
its *mutation* controls on role, but rendered the "Prévisualiser" button for
everyone — and `getReviewMediaUrlAction` is `requireWorkerOrAdmin`. Because an
allow-list guard **redirects** rather than erroring, a commercial clicking it
did not see a failure: they were thrown to `/dashboard`, losing the page.

Playback is now a prop of its own, because it is a question of its own. A
commercial holds RLS on the review tables for their own clients but **no policy
on the `review-media` bucket**, so even a widened action would fail at storage.
Widening that bucket is a permission decision, not an audit fix.

**Evidence:** three e2e tests, all previously absent; the regression pin asserts
the button is gone, the explanation is shown, and the URL is still the review
page rather than `/dashboard`.

### 3. A TVA-disabled document stated a TVA rate — on paper — `530627d`

Phase 9 wired the per-document toggle through the builder, the server and the
stored columns, but not through the two views that display the result. Neither
the detail page nor the print page **selected** `tva_enabled`, so neither could
distinguish "no tax applies" from "tax applies and came to zero".

The printed document was the worse half: its per-line tax column rendered
`TVA 19%` against **every line item**, and the totals block carried a
`TVA (19%)` row. On a Tunisian fiscal document that misstates the tax
treatment.

Both views now omit the tax entirely when it is off, rather than showing zero —
`TVA (19%)  0,00 DT` is itself a claim, that a 19% rate was applied and produced
nothing.

**Evidence:** seeded devis 9007 with the tax off; two e2e tests, including the
control that an enabled document still states its tax, so a fix that stripped
the row everywhere could not pass. Adding the column to the print page's SELECT
was *not* sufficient — that page rebuilds a narrow object field by field, so
the flag reached the query and stopped there. The e2e test caught it.

---

## Measured clean — no defect, now pinned

### Owner-run views — `08e7f16`

The seven `portal_*` / `client_directory` views bypass RLS by design, which
makes each one a boundary whose entire access control is its grant list.
Nothing was asserting that list.

| Probe | Result |
|---|---|
| Grants to `anon` or `PUBLIC` | none |
| Grants to `authenticated` beyond `SELECT` | none |
| `anon` reading each view | refused outright (no grant) |
| Authenticated session with no membership | 0 rows from all seven |

Now covered by tests written **over the view list by pattern**, so a view added
later is covered the day it appears — the case that matters, since Supabase
grants ALL on new `public` objects to `authenticated` by default and a
single-table view is auto-updatable.

### Database-wide posture

| Probe | Result |
|---|---|
| `public` tables with RLS disabled | **none** |
| RLS-enabled tables with zero policies | **none** |
| `SECURITY DEFINER` functions without a pinned `search_path` | **none** |
| `anon` reach into clients, projects, tasks, devis, payments, profiles, review_assets, content_items, audit_log, money_shadow_log | 0 rows each |
| Storage buckets | `review-media` and `task-files` private; `avatars` public |

---

## Noted, not changed

**`avatars` is a public bucket.** Pre-dates this programme; the application
serves staff photos through `getPublicUrl`, so anyone holding a URL can fetch
one. Paths are `<profile-id>/<timestamp>.<ext>`, so they are not enumerable,
and no client-facing surface exposes an employee avatar. Changing it would
require signed URLs on every internal avatar render — a design decision, not an
audit fix.

**`/dashboard/*` returns HTTP 200 with 404 content** for a missing or forbidden
id. The dashboard streams through a heavy layout, so the status is committed
before `notFound()` runs; the portal, with no such layout, does return 404.
The security property is unaffected and is now asserted directly: a forbidden
id and an invented one produce **identical status and identical body**, so
neither is an oracle for the other.

**Routes without a `loading.tsx`:** `review`, `reports`, `audit`, `projects`,
`finance`, `content`, `team`. They render server-side and show the previous
page during navigation rather than a skeleton. Cosmetic; listed for
completeness.

---

## Process finding

The `mksync.sh` sync helper runs `git add -A`, which stages the whole tree as a
side effect of syncing. During this audit that swept two unrelated fixes into
one commit; it was split before anything else was built on top (`d7b7bec` /
`ee6702a`). Commit *before* syncing, or stage explicitly after.

The WSL runner was found **detached at `a36285f` with 556 dirty files** — a
consequence of the tar sync writing files git never learns about. Harmless for
correctness, misleading for provenance: "which commit did these tests run
against?" had no trustworthy answer. It was hard-reset to the canonical commit
(runner only; the canonical Windows repo is fetched read-only) and now reports
0 dirty files.

**A measurement that lied about itself.** The teardown check reported two stray
`next-server` processes after having just reported zero. There were none: the
probe ran as `bash -lc '... pgrep -f next-server ...'`, so the shell's own
command line contained the pattern and `pgrep` counted itself. Run from a
script file, where the command line is just the script path, it reports none.
This is the self-matching trap already recorded for `pkill` — worth noting that
it corrupts *measurements* as readily as it kills the wrong process, and that a
teardown proof is exactly where a false positive is most expensive.
