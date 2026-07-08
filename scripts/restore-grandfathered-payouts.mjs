/**
 * One-off remediation: restore grandfathered pick payouts wrongly re-priced on
 * 2026-07-07.
 *
 * What went wrong: the first cut of settle_match_picks (018) re-evaluated EVERY
 * pick against the CURRENT payout formula on each call. The cron calls settle for
 * every finished match every tick, so it retroactively re-priced all historical
 * picks from the old doubling formula (002/012: floor((1+2*stake)*mult+0.5)) down
 * to the return-rate formula (016: floor(stake*mult+0.5)+1), slashing winnings on
 * every pick settled before the formula changed. That broke the never-negative
 * invariant (the staking budget otherwise makes a negative balance impossible)
 * and pushed heavy bettors deep negative.
 *
 * The RPC preserved settled_at (coalesce), and stake / stake_mult are snapshotted
 * at placement, so each pick's correct ORIGINAL payout is fully reconstructable:
 *
 *   correct pick settled ON/BEFORE the formula boundary -> doubling
 *   correct pick settled AFTER the boundary             -> return-rate
 *   wrong pick                                          -> 0
 *
 * Boundary: settlement events have a clean gap between the last group-stage
 * settlement (2026-06-28T04:05:03Z) and the first post-016 settlement
 * (2026-06-29T01:43:25Z, the manual RSA/CAN re-honor). No pick settled in that
 * window, so any cutoff inside it is exact. We use 2026-06-28T12:00:00Z.
 *
 * This only rewrites picks whose payout differs from the reconstruction (203
 * pre-boundary picks). Post-boundary picks - including the correct SUI/COL fix
 * (537382, all Colombia picks -> 0) - are already right and stay untouched.
 * settle_match_picks has since been rewritten to minimal-touch so the cron will
 * NOT re-price these again.
 *
 * Backs up every current pick first. Run: node scripts/restore-grandfathered-payouts.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const BOUNDARY = "2026-06-28T12:00:00Z";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await client.connect();

// ---- full backup of every pick (we never took one before the damage) ----
const all = (await client.query(
  `select group_id, user_id, match_id, pick, stake, stake_mult, settled_at, payout_wcp, payout_wcc from wc_picks order by settled_at nulls last, match_id, user_id`,
)).rows;
const backupPath = `scripts/all-picks-backup-${Date.now?.() ? "" : ""}pre-restore.json`;
writeFileSync("scripts/all-picks-backup-pre-restore.json", JSON.stringify(all, null, 2));
console.log(`backed up ${all.length} picks -> scripts/all-picks-backup-pre-restore.json`);

// ---- compute the correct payout per settled, non-refund pick ----
const picks = (await client.query(`
  select p.match_id, p.user_id, p.pick, p.stake, coalesce(p.stake_mult,1.0)::float mult,
         p.settled_at, p.payout_wcp cur,
         m.winner_code, m.team_a_code, m.team_b_code
  from wc_picks p join wc_matches m on m.id=p.match_id
  where p.settled_at is not null and p.payout_wcc=0`)).rows;

function correctPayout(p) {
  const correct = (p.pick === "A" && p.winner_code === p.team_a_code)
    || (p.pick === "B" && p.winner_code === p.team_b_code)
    || (p.pick === "D" && p.winner_code === null);
  if (!correct) return 0;
  const s = Number(p.stake), m = Number(p.mult);
  return p.settled_at.toISOString() <= BOUNDARY
    ? Math.floor((1 + 2 * s) * m + 0.5)   // doubling era
    : Math.floor(s * m + 0.5) + 1;        // return-rate era
}

const updates = [];
for (const p of picks) {
  const want = correctPayout(p);
  if (want !== p.cur) updates.push({ user_id: p.user_id, match_id: p.match_id, want, from: p.cur, when: p.settled_at.toISOString() });
}
// hard guard: refuse to touch anything settled after the boundary
const postBoundary = updates.filter((u) => u.when > BOUNDARY);
if (postBoundary.length) {
  console.error(`ABORT: ${postBoundary.length} post-boundary updates proposed; expected 0`);
  process.exit(1);
}
console.log(`picks to restore: ${updates.length} (net WCC ${updates.reduce((s,u)=>s+(u.want-u.from),0)})`);

await client.query("begin");
for (const u of updates) {
  await client.query(
    `update wc_picks set payout_wcp=$1 where user_id=$2 and match_id=$3`,
    [u.want, u.user_id, u.match_id],
  );
}
await client.query("commit");
console.log("applied.");

await client.query(`select wc_refresh_user_scores(null)`);
console.log("refreshed user scores");

// ---- verify: no negatives, 537382 still zeroed ----
const negs = (await client.query(`select count(*) n from wc_user_scores where wcc<0`)).rows[0].n;
const m382 = (await client.query(`select coalesce(sum(payout_wcp),0) s from wc_picks where match_id=537382`)).rows[0].s;
console.log(`\nusers negative: ${negs}  (expect 0)`);
console.log(`537382 total payout_wcp: ${m382}  (expect 0 - Switzerland won)`);

await client.end();
