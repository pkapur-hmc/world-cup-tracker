/**
 * One-off remediation: re-settle SUI/COL (match 537382, r16, 2026-07-07).
 *
 * The match went to penalties (final SUI 4-3). A volatile feed briefly showed
 * Colombia ahead, the match settled at 22:48 paying every Colombia (pick "B")
 * bet, then football-data corrected the row to SUI 4-3 (winner_code=SUI). Because
 * old settlement was one-shot, the payouts stayed frozen on the Colombia win:
 * the UI read winner=SUI while WCC totals rode Colombia-win payouts.
 *
 * settle_match_picks is now self-healing (scripts/018), so it re-evaluates every
 * pick against the current winner. This just re-runs it once against the
 * now-correct row (all Colombia picks -> 0) and refreshes user scores. Going
 * forward the cron heals this automatically; this script closes out the match
 * that was already stranded before the fix shipped.
 *
 * Run: node scripts/resettle-537382.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const MATCH_ID = 537382;

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

// Self-healing settle: no manual clearing needed - it rewrites any payout that
// no longer matches the current winner and returns the count it changed.
const changed = (await client.query(`select settle_match_picks($1) as n`, [MATCH_ID]))
  .rows[0].n;
console.log(`re-settled: ${changed} picks changed`);

await client.query(`select wc_refresh_user_scores(null)`);
console.log("refreshed user scores");

const after = (await client.query(
  `select ${cols} from wc_picks where match_id = $1 order by picked_at`,
  [MATCH_ID],
)).rows;
console.log("\n=== payouts (A=SUI winner, B=COL, D=draw) ===");
for (const p of after) {
  console.log(
    `pick=${p.pick} stake=${p.stake} mult=${p.stake_mult} -> payout_wcp=${p.payout_wcp}`,
  );
}

await client.end();
