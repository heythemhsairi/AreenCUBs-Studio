import { beforeAll, describe, expect, it } from "vitest";
import {
  USERS,
  dbAvailable,
  sql,
  sqlAs,
  sqlAsExpectDeniedOrZero,
  sqlExpectError,
} from "./sql.mjs";

beforeAll(() => {
  if (!dbAvailable()) throw new Error("No local staging database");
});

const count = (user, table) => Number(sqlAs(user, `select count(*) from public.${table};`));

describe("worker payroll schema and seed", () => {
  it("creates the five protected payroll tables", () => {
    expect(Number(sql("select count(*) from pg_tables where schemaname='public' and tablename like 'payroll_%';"))).toBe(5);
  });

  it("seeds the seven brief rates in integer millimes", () => {
    expect(sql("select string_agg(code || ':' || base_rate_millimes || ':' || above_rate_millimes || ':' || output_points, ',' order by position) from public.payroll_task_types;")).toBe(
      "video:40000:60000:1,post:8000:12000:1,carousel:24000:36000:3,script:8000:12000:1,publication:10000:15000:1,marketing_strategy:60000:90000:3,brand_identity:120000:180000:5",
    );
  });

  it("creates one task credit from the fabricated completed task", () => {
    expect(sql("select count(*) from public.payroll_task_credits where task_id='7a000000-0000-4000-8000-000000000005';")).toBe("1");
  });
});

describe("payroll RLS", () => {
  it("a worker sees only their own settings, credits, bonuses and payments", () => {
    expect(count(USERS.worker, "payroll_worker_settings")).toBe(1);
    expect(count(USERS.worker, "payroll_task_credits")).toBe(1);
    expect(count(USERS.worker, "payroll_bonuses")).toBe(1);
    expect(count(USERS.worker, "payroll_payments")).toBe(0);
    expect(count(USERS.worker, "payroll_task_types")).toBe(7);
  });

  it("every non-worker, non-admin role sees zero payroll rows", () => {
    for (const role of ["freelancer", "commercial", "intern", "client", "orphan"]) {
      for (const table of ["payroll_worker_settings", "payroll_task_credits", "payroll_bonuses", "payroll_payments", "payroll_task_types"]) {
        expect(count(USERS[role], table), `${role} reached ${table}`).toBe(0);
      }
    }
  });

  it("a worker cannot edit a rate or assign payroll credit directly", () => {
    expect(Number(sqlAsExpectDeniedOrZero(USERS.worker, "with u as (update public.payroll_task_types set base_rate_millimes=1 returning 1) select count(*) from u;"))).toBe(0);
    expect(Number(sqlAsExpectDeniedOrZero(USERS.worker, "with u as (update public.tasks set payroll_credit_user_id='22222222-2222-4222-8222-222222222222', payroll_task_type_id=(select id from public.payroll_task_types where code='post') where id='7a000000-0000-4000-8000-000000000001' returning 1) select count(*) from u;"))).toBe(0);
  });
});

describe("payroll completion rules", () => {
  it("refuses payroll work logged on a weekend", () => {
    const error = sqlExpectError(`
      update public.tasks set
        payroll_credit_user_id='22222222-2222-4222-8222-222222222222',
        payroll_task_type_id=(select id from public.payroll_task_types where code='post'),
        status='done', completed_at='2026-08-08 12:00:00+01'
      where id='7a000000-0000-4000-8000-000000000001'
    `);
    expect(error).toContain("Payroll work cannot be completed on a weekend");
  });
});
