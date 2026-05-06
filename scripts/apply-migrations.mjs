// One-off helper: applies every SQL file in supabase/migrations/ via the
// Supabase Management API. Useful when you can't run `supabase db push`
// (e.g. CI without a TTY).
//
// Usage:
//   SUPABASE_PAT=sbp_xxx node scripts/apply-migrations.mjs

import fs from "node:fs/promises";
import path from "node:path";

const PAT = process.env.SUPABASE_PAT;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? "exdatjsgeomejhdofgvw";

if (!PAT) {
  console.error("Set SUPABASE_PAT env var.");
  process.exit(1);
}

const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
const dir = path.join(process.cwd(), "supabase", "migrations");

const files = (await fs.readdir(dir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`Applying ${files.length} migrations to ${PROJECT_REF}...\n`);

for (const file of files) {
  const sql = await fs.readFile(path.join(dir, file), "utf8");
  process.stdout.write(`→ ${file} ... `);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`FAILED (${res.status})\n${text}`);
    process.exit(1);
  }
  console.log("OK");
}

console.log("\nAll migrations applied successfully.");
