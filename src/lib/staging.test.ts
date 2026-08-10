import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Staging environment guards.
 *
 * The standing constraint is that the local environment is free, isolated and
 * contains NO production client or financial data. That is easy to state and
 * easy to violate later — pasting a real client list into seed.sql to "make
 * testing realistic" is exactly the kind of shortcut these tests exist to
 * catch.
 */

const ROOT = join(__dirname, "..", "..");
const seed = readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8");
const config = readFileSync(join(ROOT, "supabase", "config.toml"), "utf8");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

describe("seed data is synthetic", () => {
  it("uses only non-routable .invalid or .local email domains", () => {
    const emails = seed.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    const real = emails.filter((e) => !/\.(invalid|local)$/i.test(e));
    // .invalid is reserved by RFC 2606 and can never resolve, so a seeded
    // address can never reach a real inbox.
    expect(real).toEqual([]);
  });

  it("never contains the production Supabase project ref", () => {
    expect(seed).not.toMatch(/exdatjsgeomejhdofgvw/i);
  });

  it("contains no JWT-shaped strings", () => {
    // Anything starting eyJ... is a base64url JWT header — a leaked key.
    expect(seed).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });

  it("marks fabricated records explicitly", () => {
    expect(seed).toMatch(/FABRICATED/);
    expect(seed).toMatch(/LOCAL USE ONLY/i);
  });

  it("uses obviously fake tax identifiers", () => {
    const matricules = seed.match(/'[A-Z0-9-]{10,}'/g) ?? [];
    for (const m of matricules.filter((x) => /matricule|FAKE/i.test(x) || /^'FAKE/.test(x))) {
      expect(m).toMatch(/FAKE/);
    }
  });

  it("reproduces the finding #5 contradiction so fixes can be verified", () => {
    // 1190.00 paid against a 1191.00 total, status 'paid'.
    expect(seed).toMatch(/1191\.00/);
    expect(seed).toMatch(/1190\.00/);
  });

  it("includes an auth user with no profile, for the fail-closed path", () => {
    expect(seed).toMatch(/orphan@staging\.local/);
  });
});

describe("local stack configuration", () => {
  it("binds the database and API to loopback ports only", () => {
    expect(config).toMatch(/\[db\]/);
    expect(config).toMatch(/port\s*=\s*54322/);
    expect(config).toMatch(/\[api\]/);
    expect(config).toMatch(/port\s*=\s*54321/);
  });

  it("captures auth email locally instead of delivering it", () => {
    // Inbucket prevents staging from ever emailing a real client.
    expect(config).toMatch(/\[inbucket\]/);
    expect(config).toMatch(/enabled\s*=\s*true/);
  });

  it("disables email confirmation so synthetic logins work locally", () => {
    const authEmail = config.slice(config.indexOf("[auth.email]"));
    expect(authEmail).toMatch(/enable_confirmations\s*=\s*false/);
  });

  it("warns that the linked project is production", () => {
    expect(config).toMatch(/PRODUCTION/);
  });
});

describe("production write paths are guarded", () => {
  it("db:push refuses to run", () => {
    expect(pkg.scripts["db:push"]).toMatch(/REFUSED/);
    expect(pkg.scripts["db:push"]).toMatch(/exit 1/);
  });

  it("provides local lifecycle scripts instead", () => {
    for (const s of ["db:start", "db:stop", "db:reset", "db:status", "db:verify"]) {
      expect(pkg.scripts[s]).toBeTruthy();
    }
  });

  it("keeps db:reset pointed at the local stack", () => {
    // `supabase db reset` operates on the local database only; it has no
    // remote form that could be triggered by accident.
    expect(pkg.scripts["db:reset"]).toBe("supabase db reset");
  });
});
