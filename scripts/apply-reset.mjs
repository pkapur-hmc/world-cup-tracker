/**
 * Run the one-time knockout soft reset (apply_knockout_compression) over the
 * direct pg connection and print before/after + the batch id (for reverting).
 *
 *   node scripts/apply-reset.mjs            # factor 0.4 (default)
 *   node scripts/apply-reset.mjs 0.4
 *
 * To undo:  node scripts/revert-reset.mjs <batch_id>
 * RUN ONCE - it is NOT idempotent (a second run compresses again).
 */
import { readFileSync } from "node:fs";
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

const factor = Number(process.argv[2] ?? 0.4);
const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const res = await client.query("select * from public.apply_knockout_compression($1)", [factor]);
  const moved = res.rows.filter((r) => Number(r.delta) !== 0);
  console.log(`factor ${factor} - ${moved.length} player(s) compressed:`);
  for (const r of res.rows.sort((a, b) => Number(b.old_wcc) - Number(a.old_wcc)).slice(0, 12)) {
    if (Number(r.delta) !== 0)
      console.log(`  ${String(r.old_wcc).padStart(5)} -> ${String(r.new_wcc).padStart(5)}  (${r.delta})`);
  }
  const b = await client.query(
    "select distinct batch_id from public.wc_score_adjustments where reason = 'knockout_compression'",
  );
  console.log("\nbatch_id (keep this to revert):", b.rows.map((r) => r.batch_id).join(", "));
} finally {
  await client.end();
}
