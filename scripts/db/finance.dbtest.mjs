import { describe, it, expect, beforeAll } from "vitest";
import { sql, dbAvailable } from "./sql.mjs";

/**
 * Finance integration coverage — audit finding #5.
 *
 * READ-ONLY with respect to business rules. These tests document the current
 * behaviour of the seeded contradictions; they do NOT wire the money module,
 * change any calculation, or alter a stored document. The money divergence
 * decision is still outstanding (docs/audit/MONEY-COMPATIBILITY.md §4).
 *
 * All amounts are fabricated. See supabase/seed.sql.
 */

beforeAll(() => {
  if (!dbAvailable()) {
    throw new Error("No local staging database. Run: npm run db:start && npm run db:reset");
  }
});

/** Money actually received against a document. */
const paidFor = (id) =>
  Number(sql(`select coalesce(sum(amount_dt),0) from public.payments where devis_id='${id}';`));

describe("stored payment status vs money-derived settlement", () => {
  it("an invoice marked paid can still carry a balance", () => {
    // The exact production contradiction, reproduced from fabricated data.
    const rows = sql(
      `select d.id::text || '|' || d.total_dt::text || '|' ||
              coalesce((select sum(p.amount_dt) from public.payments p where p.devis_id=d.id),0)::text
       from public.devis d
       where d.kind='facture' and d.payment_status='paid'
         and d.total_dt - coalesce((select sum(p.amount_dt) from public.payments p
                                    where p.devis_id=d.id),0) > 0.01;`,
    );
    expect(rows).not.toBe("");
    const [, total, paid] = rows.split("\n")[0].split("|");
    expect(Number(total) - Number(paid)).toBeCloseTo(1, 2);
  });

  it("the shortfall equals the fiscal stamp exactly", () => {
    // Traces to migration 0025, which raised total_dt by the stamp on
    // already-settled invoices without reconciling payments or status.
    const gap = sql(
      `select round(d.total_dt - coalesce((select sum(p.amount_dt) from public.payments p
                                           where p.devis_id=d.id),0), 2)
       from public.devis d
       where d.kind='facture' and d.payment_status='paid'
         and d.total_dt - coalesce((select sum(p.amount_dt) from public.payments p
                                    where p.devis_id=d.id),0) > 0.01
       limit 1;`,
    );
    expect(Number(gap)).toBe(1);
    const stamp = sql(
      `select stamp_dt from public.devis
       where kind='facture' and payment_status='paid'
         and total_dt - coalesce((select sum(p.amount_dt) from public.payments p
                                  where p.devis_id=devis.id),0) > 0.01
       limit 1;`,
    );
    expect(Number(stamp)).toBe(1);
  });

  it("stored status and derived settlement disagree — they are separate facts today", () => {
    const stored = sql(
      `select count(*) from public.devis where kind='facture' and payment_status='paid';`,
    );
    const derived = sql(
      `select count(*) from public.devis d where d.kind='facture'
       and d.total_dt - coalesce((select sum(p.amount_dt) from public.payments p
                                  where p.devis_id=d.id),0) <= 0.01;`,
    );
    // Two documents claim 'paid'; fewer are genuinely settled.
    expect(Number(stored)).toBeGreaterThan(Number(derived));
  });
});

describe("impossible state combinations are not prevented by the database", () => {
  it("a DRAFT invoice can be marked paid", () => {
    const n = Number(
      sql(`select count(*) from public.devis where kind='facture' and status='draft'
           and payment_status='paid';`),
    );
    expect(n).toBeGreaterThan(0);
  });

  it("a QUOTE carries a payment_status although quotes have no payment concept", () => {
    const n = Number(
      sql("select count(*) from public.devis where kind='devis' and payment_status is not null;"),
    );
    expect(n).toBeGreaterThan(0);
  });

  it("payment_status is NOT NULL on every row, including quotes", () => {
    // Root cause: devis and factures share one table, and the column applies
    // to both. There is nowhere to express "not applicable".
    const nullable = sql(
      `select is_nullable from information_schema.columns
       where table_name='devis' and column_name='payment_status';`,
    );
    expect(nullable).toBe("NO");
  });

  it("no CHECK constraint ties kind, status and payment_status together", () => {
    const n = Number(
      sql(`select count(*) from pg_constraint c join pg_class t on t.oid=c.conrelid
           where t.relname='devis' and c.contype='c'
             and pg_get_constraintdef(c.oid) ilike '%payment_status%';`),
    );
    expect(n).toBe(0); // the gap Phase 1 must close, pending approval
  });
});

describe("the two definitions of unpaid used by the application", () => {
  it("the status-filtered KPI omits balances that the money-derived view reports", () => {
    // Mirrors finance.ts:216 — the global KPI filters on payment_status, so
    // anything marked 'paid' is excluded regardless of what is owed.
    const kpi = Number(
      sql(`select coalesce(sum(d.total_dt - coalesce((select sum(p.amount_dt)
             from public.payments p where p.devis_id=d.id),0)),0)
           from public.devis d
           where d.kind='facture' and d.payment_status in ('unpaid','partial');`),
    );
    // Mirrors finance.ts:405 — the client risk table recomputes from money.
    const derived = Number(
      sql(`select coalesce(sum(greatest(d.total_dt - coalesce((select sum(p.amount_dt)
             from public.payments p where p.devis_id=d.id),0), 0)),0)
           from public.devis d where d.kind='facture';`),
    );
    expect(derived).toBeGreaterThan(kpi);
  });

  it("names every document the KPI hides, and why", () => {
    // Asserting the aggregate difference alone was brittle and wrong: it also
    // swept in the draft-marked-paid invoice. Enumerating the hidden documents
    // is both stricter and honest about what is being measured.
    const hidden = sql(
      `select d.devis_number::text || ':' ||
              round(d.total_dt - coalesce((select sum(p.amount_dt)
                from public.payments p where p.devis_id=d.id),0), 2)::text
       from public.devis d
       where d.kind='facture'
         and d.payment_status not in ('unpaid','partial')
         and d.total_dt - coalesce((select sum(p.amount_dt)
             from public.payments p where p.devis_id=d.id),0) > 0.01
       order by d.devis_number;`,
    );
    const rows = hidden.split("\n").filter(Boolean);
    // 9001: settled invoice left 1 DT short by the stamp heal.
    // 9002: draft invoice marked paid with nothing received at all.
    expect(rows).toContain("9001:1.00");
    expect(rows).toContain("9002:596.00");
    expect(rows).toHaveLength(2);
  });

  it("isolates the stamp case: exactly 1.00 DT outstanding on a 'paid' invoice", () => {
    const gap = sql(
      `select round(d.total_dt - coalesce((select sum(p.amount_dt)
         from public.payments p where p.devis_id=d.id),0), 2)
       from public.devis d where d.devis_number = 9001;`,
    );
    expect(Number(gap)).toBe(1);
  });
});

describe("stamp migration behaviour (0024 / 0025)", () => {
  it("stamp_dt exists, defaults to 0 and is never negative in the fixture", () => {
    expect(Number(sql("select count(*) from public.devis where stamp_dt < 0;"))).toBe(0);
    const def = sql(
      `select column_default from information_schema.columns
       where table_name='devis' and column_name='stamp_dt';`,
    );
    expect(def).toContain("0");
  });

  it("every document's total equals its own stored components", () => {
    // What migration 0025 guarantees. It does NOT reconcile payments, which is
    // precisely how the 1 DT contradiction arises.
    const bad = Number(
      sql(`select count(*) from public.devis
           where total_dt is distinct from round(
             coalesce(subtotal_dt,0) - coalesce(discount_dt,0)
             + coalesce(tva_dt,0) + coalesce(stamp_dt,0), 2);`),
    );
    expect(bad).toBe(0);
  });

  it("the stamp is excluded from the VAT base", () => {
    // Scoped to TVA-ENABLED documents. The invariant is about how the tax is
    // computed when it applies; a document with the tax switched off stores
    // tva_dt = 0 while retaining its rate for the record, and comparing that
    // zero against rate x base would flag correct data as broken.
    const bad = Number(
      sql(`select count(*) from public.devis
           where tva_enabled
             and tva_dt <> round((coalesce(subtotal_dt,0) - coalesce(discount_dt,0))
                                 * coalesce(tva_rate,0) / 100, 2);`),
    );
    expect(bad).toBe(0);

    // And the disabled case holds its own, stricter invariant: no tax at all.
    const badDisabled = Number(
      sql("select count(*) from public.devis where not tva_enabled and tva_dt <> 0;"),
    );
    expect(badDisabled).toBe(0);
  });
});

describe("bonus lines", () => {
  it("a bonus line contributes nothing to its document total", () => {
    const bonus = sql(
      `select line_total_dt from public.devis_items where is_bonus limit 1;`,
    );
    expect(Number(bonus)).toBe(0);
  });

  it("line totals reconcile to the stored subtotal", () => {
    const mismatched = Number(
      sql(`select count(*) from (
             select d.id, d.subtotal_dt,
                    coalesce(sum(i.line_total_dt),0) as lines
             from public.devis d
             left join public.devis_items i on i.devis_id = d.id
             group by d.id, d.subtotal_dt
           ) x where abs(x.subtotal_dt - x.lines) > 0.005;`),
    );
    expect(mismatched).toBe(0);
  });
});

describe("no financial behaviour was changed by this suite", () => {
  it("the money module is not referenced by any database object", () => {
    const n = Number(
      sql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and prosrc ilike '%millime%';`),
    );
    expect(n).toBe(0);
  });

  it("document totals are unchanged from the seeded fixture", () => {
    const total = sql("select round(sum(total_dt),2) from public.devis;");
    // 1191.00 + 596.00 + 3570.00 + 2381.00 + 4523.00 + 1785.00 + 800.00.
    //
    // The last term is the commercial-authored draft added in Phase 2 so the
    // draft-only rule has a document to act on. The constant is deliberately
    // hard-coded rather than derived: this assertion exists to catch a TEST
    // that mutates money, and a computed expectation would move with the
    // damage it is supposed to detect. It changes only when the seed does.
    expect(Number(total)).toBeCloseTo(14846, 2);
  });
});
