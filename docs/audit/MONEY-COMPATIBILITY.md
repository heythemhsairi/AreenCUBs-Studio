# Money module — API and compatibility plan

**Status:** module built and tested. **Not yet wired into any persistence path.**
**Blocking:** management approval on §4 before the formula replaces the four existing copies.

---

## 1. Why this module exists

The quote/invoice formula is currently written out **four times**:

| Copy | Location | Role |
|---|---|---|
| 1 | `src/app/dashboard/devis/devis-builder.tsx:148-166` | live preview in the browser |
| 2 | `src/app/dashboard/devis/actions.ts:108-125` | authoritative value written to the database |
| 3 | `src/app/devis/[id]/print/print-view.tsx` | printed PDF |
| 4 | `supabase/migrations/20260626000003_fix_devis_totals.sql:15-20` | SQL heal migration |

They agree today only because a human keeps them in step. One example of how thin that margin is: the server copy does **not** exclude bonus lines from the subtotal. It stays correct purely because `parseDevisInput` zeroes `unit_price_dt` for bonus rows 47 lines earlier (`actions.ts:61`). Delete that one side effect and every quote containing a free line silently overcharges.

In the new module, "a bonus line is free" is part of the formula itself.

---

## 2. Public API

```ts
import { computeDocumentTotals, toDtView, computeBalance } from "@/lib/money";
```

### `computeDocumentTotals(input): DocumentTotals`

Pure, total, deterministic. No clock, no locale, no I/O; no input shape makes it throw.

```ts
type TotalsInput = {
  items: readonly { quantity: number; unitPriceDt: number; isBonus?: boolean }[];
  discount?:    { type: "none" } | { type: "amount"; valueDt: number } | { type: "percent"; value: number };
  vat?:         { enabled: boolean; ratePercent: number };
  fiscalStamp?: { enabled: boolean; amountDt: number };
};
```

Returns `lineTotals`, `subtotal`, `discountAmount`, `net`, `vatAmount`, `vatRateApplied`, `stampAmount`, `total` — all as integer **millimes** — plus `calculationVersion`.

`toDtView()` converts to the DT field names the existing `numeric(10,2)` columns use (`subtotalDt`, `discountDt`, `tvaDt`, `stampDt`, `totalDt`).

### Calculation order (business rule — do not reorder)

1. Line total = unit price × quantity (bonus lines are free)
2. Subtotal = Σ line totals
3. Discount, clamped to `[0, subtotal]`
4. Net = subtotal − discount
5. VAT = net × rate, **only when enabled on this document**
6. Stamp added after VAT, itself untaxed
7. Total = net + VAT + stamp

### `computeBalance(totalDue, payments): BalanceResult`

Derives `unpaid | partial | paid | overpaid` **from money received**, never from a stored flag. This is the structural fix for audit finding #5: a document can no longer be "paid" while carrying a balance, because the two are no longer independent facts.

Settlement tolerance is one constant, `SETTLEMENT_TOLERANCE = 0.01 DT`, replacing the `0.01` literals scattered through `src/lib/finance.ts`.

### VAT is per-document

`vat: { enabled, ratePercent }` and `fiscalStamp: { enabled, amountDt }` are **snapshots stored on the document**, not global settings read at render time. `carryOverTaxConfiguration()` copies a quote's snapshot onto the invoice it becomes, so accepting an old quote cannot change what the client is charged, and changing company defaults cannot alter historical documents.

---

## 3. Why integer millimes

`0.1 + 0.2 !== 0.3`, and `(1.005).toFixed(2) === "1.00"` because 1.005 is stored as 1.00499999999999989…. The legacy formula uses both patterns on money that is then persisted.

All arithmetic is therefore integer millimes (1/1000 DT, the dinar's real minor unit). Amounts are quantized to centimes (2 dp) at documented boundaries so every stored value stays exactly representable in the existing `numeric(10,2)` columns. **No database column changes.**

> **A bug this discipline caught during development.** The first implementation rounded to millimes and then to centimes — a double rounding. 19% of 0.13 DT is exactly 0.0247, which correctly rounds to **0.02**; double rounding produced 0.025 then **0.03**. The legacy-equivalence sweep flagged it at a 5.25% divergence rate, and it is now fixed and covered by a dedicated regression test. Divergence after the fix: **0.900%**, every case verified (§4).

---

## 4. Measured divergence from the legacy formula ⚠ APPROVAL REQUIRED

Test: `src/lib/money/legacy-equivalence.test.ts`, which runs a verbatim transcription of the production formula against the new one.

| Metric | Result |
|---|---|
| Realistic documents (8 representative cases) | **0 divergences** |
| Systematic sweep (12 quantities × 500 prices) | **54 / 6000 = 0.900%** |
| Maximum disagreement | **exactly 0.01 DT**, never more |
| Direction | New value is **always** the correct one |

**Every one of the 54 divergences is machine-verified**, not assumed. The test recomputes VAT in exact integer arithmetic and asserts that the new implementation matches it while the legacy value is off by exactly one centime.

Worked example — quantity 1, price 1.50 DT, VAT 19%, stamp 1 DT:

| | VAT | Total |
|---|---|---|
| Exact arithmetic | 0.285 | 2.79 |
| **New module** | **0.29** | **2.79** ✅ |
| Legacy (`toFixed`) | 0.28 | 2.78 ❌ |

`(0.285).toFixed(2)` returns `"0.28"` because 0.285 is held as 0.28499999999999997779.

A second, independent legacy defect is also recorded: because legacy rounds each stored line total but derives the subtotal from the **unrounded** sum, printed lines can fail to add up to the printed subtotal. Measured example — three lines of 3 × 0.335: **lines sum to 3.03, stored subtotal says 3.02.** The new module is self-consistent by construction.

> **Decision required.** Adopting the module means ~0.9% of future documents will differ from what today's code would have produced, by one centime, in the direction of correctness. Please confirm this is acceptable to the accountant before wiring proceeds.

---

## 5. Wiring plan (not yet executed)

Deliberately staged so nothing changes value without a checkpoint.

| Step | Change | Money at risk | Gate |
|---|---|---|---|
| **W1** | Print view + builder preview read from the module | none — display only | approval on §4 |
| **W2** | `actions.ts` `computeTotals` delegates to the module | new documents only | approval on §4 |
| **W3** | Shadow-compare: log legacy vs module on every save for two weeks, persist legacy | none | — |
| **W4** | Persist module values; `calculation_version` column added | new documents only | after W3 shows no surprises |
| **W5** | Replace the SQL formula with a generated column / `CHECK` | none | separate migration approval |

**Historical documents are never recomputed.** Existing rows keep the totals they were issued with. `calculation_version` distinguishes them so a future rule change cannot retroactively alter a past invoice.

### Rollback

W1–W2 are pure code — revert the commit. W4 adds a nullable column; rollback is `DROP COLUMN`, with no data loss because legacy values remain in the existing columns throughout. No step rewrites an existing amount.

---

## 6. Not covered here

- The 1 DT reconciliation on already-settled invoices (audit finding #5) — **separate approval, separate backup**, tracked in `PHASE-0-DISCOVERY.md §3.5`.
- Migrating `payment_status` from stored to derived — requires the state-machine work in Phase 1d of the original plan.
- Multi-currency. `currency` is in the recommended field list but every code path today assumes DT.
