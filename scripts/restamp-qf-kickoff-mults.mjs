/**
 * One-off remediation: re-stamp the two QF matches' stake multipliers to the
 * KICKOFF rate (the new product rule, scripts/019), replacing the old pick-time
 * stamps.
 *
 * Both QFs settled ~6h late (extra-time "phantom draw" limbo, see
 * PLAN-extra-time-limbo-fix.md). place_pick stamps stake_mult from the
 * wc_user_scores snapshot at PICK time, and that snapshot only advances when
 * settlements land - so picks placed while 537385 sat unsettled carry a rate
 * that ignores its result. Under the new rule a pick's rate is the bettor's
 * comeback rate at the KICKOFF of the match being bet on. This script
 * reconstructs each user's rate at each QF's kickoff and, with --apply, corrects
 * stake_mult + payout_wcp + mult_locked_at on all picks of BOTH matches.
 *
 * Retroactive scope is ONLY these two QFs (537385, 537386). Earlier rounds stay
 * grandfathered, untouched. We do NOT call settle_match_picks (it never
 * re-prices a still-correct paid pick - grandfathering, scripts/018 - so it
 * would be a no-op). Direct UPDATE is the intended path for a manual correction;
 * wc_refresh_user_scores(null) then re-anchors everyone's live rate.
 *
 * Ordering requirement: 537385 (NOR/ENG) kicks off first and settles ENG; its
 * CORRECTED result must feed the 537386 (ARG/SUI) kickoff snapshot. So step b
 * recomputes 537385 at its own kickoff, and step c reconstructs 537386 with the
 * set {settled_at <= T2} UNION {537385 picks using their step-b payouts}.
 *
 * Counterfactual snapshots mirror wc_compute_user_wcc term by term (scripts/010
 * lines 130-165), time-filtered. SQL round() is half-away-from-zero; the 017
 * saturating curve is mirrored exactly.
 *
 * Run (dry-run):  node scripts/restamp-qf-kickoff-mults.mjs
 * Apply:          node scripts/restamp-qf-kickoff-mults.mjs --apply
 */
import { readFileSync, writeFileSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");

const MATCH_1 = 537385; // NOR/ENG, kicks off first
const T1 = "2026-07-11T21:00:00.000Z"; // 537385 kickoff
const MATCH_2 = 537386; // ARG/SUI
const T2 = "2026-07-12T01:00:00.000Z"; // 537386 kickoff
// The last match that settled before T1 must be 537384's QF (asserted below).
const LAST_SETTLED_BEFORE_T1 = "2026-07-10T21:06";

const BACKUP_PATH = "scripts/qf-kickoff-restamp-backup.json";
const MAX_ABS_DELTA = 1500; // no plausible single-pick payout delta exceeds this

// ---- SQL round() is half-away-from-zero; 9*ratio is always >= 0 here. ----
const roundHalfAway = (x) => Math.sign(x) * Math.round(Math.abs(x));

// wc_deficit_ratio (scripts/017): power(least(greatest(1 - max(s,0)/l,0)/0.9,1), 2)
const deficitRatio = (score, leader) => {
  if (leader <= 0) return 0;
  const inner = Math.min(Math.max(1 - Math.max(score, 0) / leader, 0) / 0.9, 1);
  return inner * inner;
};

// stake_mult (scripts/017): (11 + round(9 * ratio)) / 10  -> 1.1 .. 2.0
const stakeMult = (score, leader) =>
  (11 + roundHalfAway(9 * deficitRatio(score, leader))) / 10;

// correct-pick payout (scripts/016/018): floor(stake * mult + 0.5) + 1
const winnerPayout = (stake, mult) => Math.floor(stake * mult + 0.5) + 1;

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l.slice(i + 1).trim().replace(/^["']|["']$/g, ""),
      ];
    }),
);

const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await client.connect();

const asMap = (rows, key, val) =>
  new Map(rows.map((r) => [r[key], Number(r[val])]));

// display_name per user (one bracket's membership is enough for a label).
const nameByUser = new Map(
  (
    await client.query(
      `select distinct on (user_id) user_id::text uid, display_name
         from wc_memberships order by user_id, joined_at`,
    )
  ).rows.map((r) => [r.uid, r.display_name]),
);
const label = (uid) => nameByUser.get(uid) ?? uid.slice(0, 8);

// ============================================================
// Reconstruct wcc for all members, mirroring wc_compute_user_wcc term by term.
//   T                : timestamp string, or null for "no time filter" (current).
//   settledPredicate : SQL boolean choosing which picks count as settled.
//   extraNetByUser   : optional Map<uid, netContribution> ADDED to the pick net
//                      term (used to inject 537385's step-b payouts into the T2
//                      snapshot, since those differ from what's stored in the DB).
// ============================================================
async function reconstructWcc({ T, settledPredicate, extraNetByUser }) {
  const tcond = (alias) => (T ? `and ${alias}.created_at <= '${T}'` : ``);

  const members = (
    await client.query(`select distinct user_id::text uid from wc_memberships`)
  ).rows.map((r) => r.uid);

  const drinks = asMap(
    (
      await client.query(
        `select user_id::text uid,
                (count(*) filter (where country_code is null)
                 + 2 * count(*) filter (where country_code is not null))::int base
           from wc_drinks d where true ${tcond("d")} group by user_id`,
      )
    ).rows,
    "uid",
    "base",
  );

  const net = asMap(
    (
      await client.query(
        `select user_id::text uid,
                coalesce(sum(coalesce(payout_wcc,0) + coalesce(payout_wcp,0) - stake),0)::int net
           from wc_picks where ${settledPredicate} group by user_id`,
      )
    ).rows,
    "uid",
    "net",
  );

  const depth = asMap(
    (
      await client.query(
        `select uid, (5 * count(*))::int depth from (
           select d.user_id::text uid, d.country_code
             from wc_drinks d
             join wc_passport_requirements r on r.country_code = d.country_code
            where d.beer_label is not null ${tcond("d")}
            group by d.user_id, d.country_code, r.beer_count
           having count(distinct d.beer_label) >= r.beer_count
         ) x group by uid`,
      )
    ).rows,
    "uid",
    "depth",
  );

  const breadth = asMap(
    (
      await client.query(
        `select user_id::text uid, (((count(distinct country_code) / 5) * 5))::int breadth
           from wc_drinks d
          where country_code is not null and beer_label is not null ${tcond("d")}
          group by user_id`,
      )
    ).rows,
    "uid",
    "breadth",
  );

  const extra = asMap(
    (
      await client.query(
        `select user_id::text uid, coalesce(sum(bonus_wcc),0)::int extra
           from wc_comeback_bonus d where true ${tcond("d")} group by user_id`,
      )
    ).rows,
    "uid",
    "extra",
  );

  const adj = asMap(
    (
      await client.query(
        `select user_id::text uid, coalesce(sum(delta),0)::int adj
           from wc_score_adjustments d where true ${tcond("d")} group by user_id`,
      )
    ).rows,
    "uid",
    "adj",
  );

  const g = (m, u) => m.get(u) ?? 0;
  const wcc = new Map();
  for (const u of members) {
    wcc.set(
      u,
      g(drinks, u) +
        g(net, u) +
        (extraNetByUser ? extraNetByUser.get(u) ?? 0 : 0) +
        g(depth, u) +
        g(breadth, u) +
        g(extra, u) +
        g(adj, u),
    );
  }
  return wcc;
}

// Load a match row + its picks. Derive which pick letter is the winner.
async function loadMatch(id) {
  const m = (
    await client.query(
      `select id, stage, team_a_code, team_b_code, score_a, score_b, winner_code, status
         from wc_matches where id = $1`,
      [id],
    )
  ).rows[0];
  const picks = (
    await client.query(
      `select user_id::text uid, pick, stake, stake_mult, settled_at, payout_wcp, payout_wcc
         from wc_picks where match_id = $1 order by picked_at`,
      [id],
    )
  ).rows;
  const winnerPick =
    m.winner_code === m.team_a_code
      ? "A"
      : m.winner_code === m.team_b_code
        ? "B"
        : null;
  return { m, picks, winnerPick };
}

// ============================================================
// Step a - self-check: reconstruct CURRENT wcc (all events, all settled picks)
// and confirm it equals stored wc_user_scores.wcc for every member. Proves the
// term-by-term mirror is faithful before we trust the counterfactuals.
// ============================================================
const currentWcc = await reconstructWcc({
  T: null,
  settledPredicate: `settled_at is not null`,
});
const stored = asMap(
  (await client.query(`select user_id::text uid, wcc from wc_user_scores`)).rows,
  "uid",
  "wcc",
);
let mismatches = 0;
for (const [u, w] of currentWcc) {
  if (stored.has(u) && stored.get(u) !== w) {
    mismatches++;
    if (mismatches <= 5) {
      console.log(
        `  self-check mismatch ${label(u)}: reconstructed ${w} vs stored ${stored.get(u)}`,
      );
    }
  }
}
if (mismatches > 0) {
  throw new Error(
    `wcc reconstruction does not match wc_user_scores for ${mismatches} user(s) - mirror is wrong, aborting`,
  );
}
console.log(
  `self-check OK: reconstructed wcc matches wc_user_scores for all ${currentWcc.size} members.`,
);

// ============================================================
// Step b - 537385 at T1 = its kickoff.
//   settled set = {settled_at <= T1}. Assert the latest settled_at before T1 is
//   537384's, so every prior match had settled promptly by kickoff.
// ============================================================
const beforeT1 = (
  await client.query(
    `select match_id, max(settled_at) ms from wc_picks
       where settled_at is not null and settled_at <= $1
       group by match_id order by ms desc limit 1`,
    [T1],
  )
).rows[0];
if (
  !beforeT1 ||
  beforeT1.match_id !== 537384 ||
  !new Date(beforeT1.ms).toISOString().startsWith(LAST_SETTLED_BEFORE_T1)
) {
  throw new Error(
    `expected latest settled before T1 to be 537384 @ ${LAST_SETTLED_BEFORE_T1}, got ${JSON.stringify(beforeT1)}`,
  );
}
console.log(
  `T1 precondition OK: last settlement before ${T1} is match ${beforeT1.match_id} @ ${new Date(beforeT1.ms).toISOString()}.`,
);

const wccT1 = await reconstructWcc({
  T: T1,
  settledPredicate: `settled_at is not null and settled_at <= '${T1}'`,
});
let leader1 = 0;
for (const w of wccT1.values()) leader1 = Math.max(leader1, w);

const match1 = await loadMatch(MATCH_1);
if (
  match1.m.status !== "final" ||
  match1.m.winner_code !== "ENG" ||
  match1.m.score_a !== 1 ||
  match1.m.score_b !== 2 ||
  match1.winnerPick !== "B"
) {
  throw new Error(`${MATCH_1} is not the expected healthy final NOR 1-2 ENG (winner pick B)`);
}
for (const p of match1.picks) {
  if (Number(p.payout_wcc) !== 0) {
    throw new Error(`${MATCH_1} pick payout_wcc != 0 for ${label(p.uid)} - unexpected`);
  }
}

// New mult per user at T1; re-price 537385 picks.
const extraNet385 = new Map(); // per-user net contribution of 537385 at step-b payouts
const plan1 = [];
for (const p of match1.picks) {
  const w = wccT1.get(p.uid);
  if (w === undefined) throw new Error(`no T1 wcc for ${label(p.uid)}`);
  const newMult = stakeMult(w, leader1);
  const isWinner = p.pick === match1.winnerPick;
  const newPayout = isWinner ? winnerPayout(p.stake, newMult) : 0;
  plan1.push({
    match_id: MATCH_1,
    uid: p.uid,
    pick: p.pick,
    stake: p.stake,
    oldMult: Number(p.stake_mult),
    newMult,
    oldPayout: Number(p.payout_wcp),
    newPayout,
    kickoff: T1,
  });
  // 537385 net at step-b payouts: payout_wcp (payout_wcc is 0) minus stake.
  extraNet385.set(p.uid, (extraNet385.get(p.uid) ?? 0) + newPayout - p.stake);
}
console.log(`\n${MATCH_1} @ T1=${T1}: leader wcc=${leader1}, ${plan1.length} picks re-stamped.`);

// ============================================================
// Step c - 537386 at T2 = its kickoff.
//   settled set = {settled_at <= T2} UNION {537385 picks at their step-b payouts}.
//   537385 settled AFTER T2 in reality, so {settled_at <= T2} excludes it; we
//   inject its corrected result via extraNet385 (the ordering requirement).
// ============================================================
const wccT2 = await reconstructWcc({
  T: T2,
  settledPredicate: `settled_at is not null and settled_at <= '${T2}'`,
  extraNetByUser: extraNet385,
});
let leader2 = 0;
for (const w of wccT2.values()) leader2 = Math.max(leader2, w);

const match2 = await loadMatch(MATCH_2);
if (
  match2.m.status !== "final" ||
  match2.m.winner_code !== "ARG" ||
  match2.m.score_a !== 3 ||
  match2.m.score_b !== 1 ||
  match2.winnerPick !== "A"
) {
  throw new Error(`${MATCH_2} is not the expected healthy final ARG 3-1 SUI (winner pick A)`);
}
for (const p of match2.picks) {
  if (Number(p.payout_wcc) !== 0) {
    throw new Error(`${MATCH_2} pick payout_wcc != 0 for ${label(p.uid)} - unexpected`);
  }
}

const plan2 = [];
for (const p of match2.picks) {
  const w = wccT2.get(p.uid);
  if (w === undefined) throw new Error(`no T2 wcc for ${label(p.uid)}`);
  const newMult = stakeMult(w, leader2);
  const isWinner = p.pick === match2.winnerPick;
  const newPayout = isWinner ? winnerPayout(p.stake, newMult) : 0;
  plan2.push({
    match_id: MATCH_2,
    uid: p.uid,
    pick: p.pick,
    stake: p.stake,
    oldMult: Number(p.stake_mult),
    newMult,
    oldPayout: Number(p.payout_wcp),
    newPayout,
    kickoff: T2,
  });
}
console.log(`${MATCH_2} @ T2=${T2}: leader wcc=${leader2}, ${plan2.length} picks re-stamped.`);

const plan = [...plan1, ...plan2];

// ============================================================
// Step e - sanity guards + full before/after table.
// ============================================================
for (const r of plan) {
  if (r.newMult < 1.1 || r.newMult > 2.0) {
    throw new Error(
      `new mult out of [1.1,2.0] for ${label(r.uid)} on ${r.match_id}: ${r.newMult}`,
    );
  }
}

console.log(
  `\nmatch    who                     pick  stake   old_m  new_m   old_pay   new_pay     delta`,
);
console.log(
  `-------  ----------------------  ----  ------  -----  -----   -------   -------   -------`,
);
let maxAbsDelta = 0;
for (const r of plan) {
  const delta = r.newPayout - r.oldPayout;
  maxAbsDelta = Math.max(maxAbsDelta, Math.abs(delta));
  console.log(
    `${String(r.match_id)}  ${label(r.uid).slice(0, 22).padEnd(22)}  ${r.pick.padEnd(4)}  ` +
      `${String(r.stake).padStart(6)}  ${r.oldMult.toFixed(1).padStart(5)}  ${r.newMult
        .toFixed(1)
        .padStart(5)}   ${String(r.oldPayout).padStart(7)}   ${String(r.newPayout).padStart(
        7,
      )}   ${(delta >= 0 ? "+" + delta : String(delta)).padStart(7)}`,
  );
}
console.log(`\nmax abs single-pick payout delta: ${maxAbsDelta}`);
if (maxAbsDelta > MAX_ABS_DELTA) {
  throw new Error(
    `a single payout delta exceeds ${MAX_ABS_DELTA} (max ${maxAbsDelta}) - implausible, reporting instead of applying`,
  );
}

// ============================================================
// Step d - mult_locked_at column must exist (migration 019). Blocks --apply
// only; the dry-run still prints the table above so it can be reviewed first.
// ============================================================
const hasLockCol =
  (
    await client.query(
      `select 1 from information_schema.columns
        where table_name = 'wc_picks' and column_name = 'mult_locked_at'`,
    )
  ).rows.length > 0;

if (!APPLY) {
  console.log(
    `\nDRY RUN. Re-run with --apply to back up and update these ${plan.length} rows.`,
  );
  if (!hasLockCol) {
    console.log(
      `NOTE: wc_picks.mult_locked_at does not exist yet - run migration 019 before --apply.`,
    );
  }
  console.log("Updates --apply WOULD perform (per row):");
  for (const r of plan) {
    console.log(
      `  update wc_picks set stake_mult=${r.newMult.toFixed(1)}, payout_wcp=${r.newPayout}, ` +
        `mult_locked_at='${r.kickoff}' where user_id='${r.uid}' and match_id=${r.match_id};`,
    );
  }
  console.log(`  select wc_refresh_user_scores(null);`);
  await client.end();
  process.exit(0);
}

if (!hasLockCol) {
  await client.end();
  throw new Error(
    `wc_picks.mult_locked_at does not exist - run migration 019 first, then re-run with --apply.`,
  );
}

// ============================================================
// Step f - APPLY: backup ALL picks on both matches, update in one transaction,
// refresh scores, reprint from DB.
// ============================================================
const backupPicks = (
  await client.query(
    `select match_id, user_id::text uid, pick, stake, stake_mult, settled_at, payout_wcp, payout_wcc
       from wc_picks where match_id = any($1::int[]) order by match_id, picked_at`,
    [[MATCH_1, MATCH_2]],
  )
).rows;
writeFileSync(
  BACKUP_PATH,
  JSON.stringify(
    { T1, T2, leader1, leader2, match1: match1.m, match2: match2.m, picks_before: backupPicks },
    null,
    2,
  ),
);
console.log(`\nbacked up ${backupPicks.length} picks -> ${BACKUP_PATH}`);

await client.query("begin");
for (const r of plan) {
  await client.query(
    `update wc_picks
        set stake_mult = $1, payout_wcp = $2, mult_locked_at = $3
      where user_id = $4 and match_id = $5`,
    [r.newMult, r.newPayout, r.kickoff, r.uid, r.match_id],
  );
}
await client.query("commit");
console.log(`updated ${plan.length} rows (stake_mult + payout_wcp + mult_locked_at).`);

await client.query(`select wc_refresh_user_scores(null)`);
console.log("refreshed user scores.");

const after = (
  await client.query(
    `select match_id, user_id::text uid, stake, stake_mult, payout_wcp, mult_locked_at
       from wc_picks where match_id = any($1::int[]) order by match_id, picked_at`,
    [[MATCH_1, MATCH_2]],
  )
).rows;
console.log("\n=== after (from DB) ===");
for (const p of after) {
  console.log(
    `${p.match_id} ${label(p.uid).slice(0, 22).padEnd(22)} stake=${p.stake} mult=${p.stake_mult} ` +
      `payout_wcp=${p.payout_wcp} locked=${p.mult_locked_at ? new Date(p.mult_locked_at).toISOString() : "null"}`,
  );
}

await client.end();
