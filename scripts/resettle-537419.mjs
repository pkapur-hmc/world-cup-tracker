/**
 * One-off remediation: re-settle POR/CRO (match 537419).
 *
 * On 2026-07-02 21:15 EDT this r32 match settled while winner_code was null -
 * football-data briefly reported FINISHED at a level score during the injury-time
 * VAR delay, before Portugal's winning goal was credited. Settlement is one-shot
 * (it stamps settled_at), so all 8 picks - Portugal winners included - locked at
 * payout 0. The row was later corrected to POR 2-1 but the picks stayed zeroed.
 *
 * This backs up the current pick rows, clears settled_at/payouts, re-runs
 * settle_match_picks against the now-correct row, and refreshes user scores.
 * The code fix in app/api/cron/sync-matches/route.ts prevents a recurrence.
 *
 * Run: node scripts/resettle-537419.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const MATCH_ID = 537419;

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await client.connect();

const cols =
  "group_id, user_id, match_id, pick, stake, stake_mult, settled_at, payout_wcp, payout_wcc";

const m = (await client.query(
  `select id, stage, team_a_code, team_b_code, score_a, score_b, winner_code, status
     from wc_matches where id = $1`,
  [MATCH_ID],
)).rows[0];
console.log("match:", JSON.stringify(m));
if (m.status !== "final" || m.winner_code === null) {
  throw new Error("refusing to re-settle: match is not final with a winner");
}

const before = (await client.query(
  `select ${cols} from wc_picks where match_id = $1 order by picked_at`,
  [MATCH_ID],
)).rows;

const backupPath = `scripts/${MATCH_ID}-resettle-backup.json`;
writeFileSync(backupPath, JSON.stringify({ match: m, picks: before }, null, 2));
console.log(`backed up ${before.length} picks -> ${backupPath}`);

await client.query("begin");
await client.query(
  `update wc_picks set settled_at = null, payout_wcp = 0, payout_wcc = 0
     where match_id = $1`,
  [MATCH_ID],
);
const settled = (await client.query(`select settle_match_picks($1) as n`, [MATCH_ID]))
  .rows[0].n;
await client.query("commit");
console.log(`re-settled: ${settled} picks`);

await client.query(`select wc_refresh_user_scores(null)`);
console.log("refreshed user scores");

const after = (await client.query(
  `select ${cols} from wc_picks where match_id = $1 order by picked_at`,
  [MATCH_ID],
)).rows;
console.log("\n=== payouts (A=POR winner, B=CRO, D=draw) ===");
for (const p of after) {
  console.log(
    `pick=${p.pick} stake=${p.stake} mult=${p.stake_mult} -> payout_wcp=${p.payout_wcp}`,
  );
}

await client.end();
