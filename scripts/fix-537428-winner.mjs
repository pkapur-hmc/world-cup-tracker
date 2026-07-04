/**
 * One-off remediation: AUS/EGY (match 537428) stuck with a null winner.
 *
 * The r32 match ended AUS 3-5 EGY but winner_code was null: the score arrived
 * from the ESPN overlay while still `live` (ESPN stamps the winner only on its
 * `post` state, and skips a row once `final`), then football-data's bulk feed
 * flipped status to final with a null fullTime, so the winner never got set. A
 * null winner reads as a draw everywhere, and the knockout settle guard
 * (correctly) refused to settle it - leaving 8 picks unsettled and the game
 * showing as a draw.
 *
 * Derive the winner from the decisive score (EGY) and settle. The code fix in
 * app/api/cron/sync-matches/route.ts adds this same safety net for the future.
 *
 * Run: node scripts/fix-537428-winner.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const MATCH_ID = 537428;

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

const m = (await client.query(
  `select id, stage, team_a_code, team_b_code, score_a, score_b, winner_code, status
     from wc_matches where id = $1`,
  [MATCH_ID],
)).rows[0];
console.log("before:", JSON.stringify(m));

if (m.status !== "final" || m.score_a === null || m.score_b === null) {
  throw new Error("refusing: match is not final with a score");
}
if (m.score_a === m.score_b) {
  throw new Error("refusing: score is level - not a decisive result");
}
if (m.winner_code !== null) {
  throw new Error(`refusing: winner_code already set (${m.winner_code})`);
}

const derived = m.score_a > m.score_b ? m.team_a_code : m.team_b_code;
console.log(`derived winner from score: ${derived}`);

const before = (await client.query(
  `select user_id, pick, stake, stake_mult, payout_wcp, settled_at
     from wc_picks where match_id = $1 order by picked_at`,
  [MATCH_ID],
)).rows;
writeFileSync(
  `scripts/${MATCH_ID}-fix-backup.json`,
  JSON.stringify({ match: m, picks: before }, null, 2),
);
console.log(`backed up ${before.length} picks -> scripts/${MATCH_ID}-fix-backup.json`);

await client.query("begin");
await client.query(`update wc_matches set winner_code = $2 where id = $1`, [
  MATCH_ID,
  derived,
]);
const settled = (await client.query(`select settle_match_picks($1) as n`, [MATCH_ID]))
  .rows[0].n;
await client.query("commit");
console.log(`set winner_code=${derived}, settled ${settled} picks`);

await client.query(`select wc_refresh_user_scores(null)`);
console.log("refreshed user scores");

const after = (await client.query(
  `select pick, stake, stake_mult, payout_wcp from wc_picks where match_id = $1 order by picked_at`,
  [MATCH_ID],
)).rows;
console.log("\n=== payouts (A=AUS, B=EGY winner) ===");
for (const p of after) {
  console.log(`pick=${p.pick} stake=${p.stake} mult=${p.stake_mult} -> ${p.payout_wcp}`);
}

await client.end();
