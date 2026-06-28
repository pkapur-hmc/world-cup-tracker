/**
 * Apply SQL migrations to Supabase over a direct Postgres connection.
 * The Supabase API keys can't run DDL, so this needs the DB connection string.
 *
 * Setup (once):
 *   Supabase dashboard -> Project Settings -> Database -> Connection string ->
 *   "URI" (Session pooler is fine). Add it to .env.local as:
 *     SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@...pooler.supabase.com:5432/postgres
 *
 * Run (in order):
 *   node scripts/run-migrations.mjs 010 011 012     # safe: flag stays off, no behavior change
 *   node scripts/run-migrations.mjs 013             # flips the multiplier ON
 *   node scripts/run-migrations.mjs 014             # one-time knockout reset (when ready)
 *
 * Each file runs in its own transaction (rolls back on error). All migrations
 * are idempotent, so re-running is safe.
 */
import { readFileSync, readdirSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const url = env.SUPABASE_DB_URL;
if (!url) {
  console.error(
    "Missing SUPABASE_DB_URL in .env.local.\n" +
      "Get it from Supabase dashboard -> Project Settings -> Database -> Connection string (URI).",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-migrations.mjs <num> [<num> ...]   e.g. 010 011 012");
  process.exit(1);
}

const allSql = readdirSync("scripts").filter((f) => f.endsWith(".sql"));
const toRun = args.map((a) => {
  const key = a.replace(/\.sql$/, "");
  const match = allSql.find((f) => f.startsWith(key + "_") || f === a || f.startsWith(key));
  if (!match) {
    console.error(`No migration file matches "${a}" in scripts/`);
    process.exit(1);
  }
  return match;
});

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  for (const f of toRun) {
    const sql = readFileSync(`scripts/${f}`, "utf8");
    process.stdout.write(`applying ${f} ... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("commit");
      console.log("ok");
    } catch (e) {
      await client.query("rollback");
      console.error(`FAILED\n${e.message}`);
      process.exit(1);
    }
  }
} finally {
  await client.end();
}
console.log("done");
