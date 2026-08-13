#!/usr/bin/env node
/**
 * Guarded, READ-ONLY production migration-history reader.
 *
 * NOT EXECUTED as part of any phase. It exists so that when approval is given,
 * the production check is one short command with no room for improvisation.
 *
 * Safety properties:
 *   - refuses to run without an explicit --i-have-approval flag
 *   - accepts only `migration list`; any other subcommand is rejected
 *   - redacts the project ref, URLs and connection strings from its output
 *   - never reads .env.local and never accepts a key as an argument
 *
 * Usage (only after approval):
 *   node scripts/prod-migration-history.mjs --i-have-approval
 */

import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);

if (!argv.includes("--i-have-approval")) {
  console.error(
    [
      "",
      "REFUSED: this command contacts the PRODUCTION Supabase project.",
      "",
      "It is read-only — it lists migration history and writes nothing — but",
      "production access requires explicit approval. Re-run with:",
      "",
      "    node scripts/prod-migration-history.mjs --i-have-approval",
      "",
      "See docs/audit/PRODUCTION-DRIFT-DECISION.md §1.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

// Anything beyond the approval flag is rejected outright: this wrapper exists
// to make exactly one read-only call, not to proxy arbitrary CLI commands.
const extra = argv.filter((a) => a !== "--i-have-approval");
if (extra.length > 0) {
  console.error(`REFUSED: unexpected arguments: ${extra.join(" ")}`);
  console.error("This wrapper runs `supabase migration list --linked` and nothing else.");
  process.exit(1);
}

/** Strips anything that could identify or authenticate against the project. */
function redact(text) {
  return String(text)
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://<redacted>")
    .replace(/https?:\/\/[a-z0-9-]+\.supabase\.(co|in)[^\s"']*/gi, "https://<redacted>.supabase.co")
    .replace(/\b[a-z]{20}\b/g, "<redacted-ref>")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<redacted-jwt>")
    .replace(/\b(password|apikey|api_key|token|secret)\s*[:=]\s*\S+/gi, "$1=<redacted>");
}

console.log("Running READ-ONLY: supabase migration list --linked");
console.log("Output is redacted before display.\n");

try {
  const out = execFileSync("npx", ["--yes", "supabase", "migration", "list", "--linked"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  console.log(redact(out));
  console.log(
    "\nCompare against docs/audit/PRODUCTION-DRIFT-DECISION.md §2-§5 to pick the repair path.",
  );
} catch (err) {
  console.error(redact(`${err.stdout ?? ""}${err.stderr ?? ""}` || err.message));
  process.exit(1);
}
