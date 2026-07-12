/**
 * Verification harness for the extra-time "phantom draw" limbo fix.
 * (PLAN-extra-time-limbo-fix.md, section 9 items 1-2.) Pure - no DB, no network.
 *
 * Run: npx tsx scripts/verify-limbo-fix.ts
 *
 * Covers:
 *  1. The three real football-data payload shapes (section 3): regulation-only
 *     FINISHED level score, complete extra-time, complete penalties - through
 *     toMatchRow + hasCompleteKnockoutResult; asserts complete/incomplete
 *     classification and the derived winner.
 *  2. The incident merge (section 4): a stored decisive knockout result vs a
 *     stale FINISHED level payload - asserts Fix A keeps the stored result, and
 *     that a decisive correction still flows (018 path). Plus that Fix B's
 *     needsLimboDetailFetch selects a winner-null limbo knockout.
 */
import {
  hasCompleteKnockoutResult,
  needsLimboDetailFetch,
  shouldKeepExistingKnockoutResult,
  toMatchRow,
  type ExistingMatchState,
  type FdMatch,
  type FdStage,
  type FdStatus,
} from "../lib/football-data";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}`);
    failures++;
  }
}

// Minimal FdMatch builder. home/away are 3-letter tlas.
function fd(opts: {
  id?: number;
  status: FdStatus;
  stage: FdStage;
  home: string;
  away: string;
  ft: [number | null, number | null];
  winner?: FdMatch["score"]["winner"];
  duration?: string;
}): FdMatch {
  return {
    id: opts.id ?? 537385,
    utcDate: "2026-07-11T19:00:00Z",
    status: opts.status,
    stage: opts.stage,
    group: null,
    homeTeam: {
      id: 1,
      name: opts.home,
      shortName: opts.home,
      tla: opts.home,
      crest: null,
    },
    awayTeam: {
      id: 2,
      name: opts.away,
      shortName: opts.away,
      tla: opts.away,
      crest: null,
    },
    score: {
      winner: opts.winner ?? null,
      duration: opts.duration,
      fullTime: { home: opts.ft[0], away: opts.ft[1] },
    },
    lastUpdated: "2026-07-11T22:00:00Z",
  };
}

// ---- Section 1: the three payload shapes through the mappers ----
console.log("1. payload-shape classification + derived winner");

// (a) regulation-only FINISHED level score on a knockout - the limbo artifact.
const regOnly = fd({
  status: "FINISHED",
  stage: "QUARTER_FINALS",
  home: "NOR",
  away: "ENG",
  ft: [1, 1],
  winner: null,
});
check("regulation-only 1-1 is NOT complete", !hasCompleteKnockoutResult(regOnly));
check(
  "regulation-only 1-1 derives winner null",
  toMatchRow(regOnly).winner_code === null,
);
check(
  "regulation-only 1-1 derives a level score",
  toMatchRow(regOnly).score_a === 1 && toMatchRow(regOnly).score_b === 1,
);

// (b) complete extra time - fullTime folds in ET; winner is the away team.
const extraTime = fd({
  status: "FINISHED",
  stage: "QUARTER_FINALS",
  home: "NOR",
  away: "ENG",
  ft: [1, 2],
  winner: "AWAY_TEAM",
  duration: "EXTRA_TIME",
});
check("complete extra-time 1-2 IS complete", hasCompleteKnockoutResult(extraTime));
check(
  "complete extra-time derives winner ENG (away)",
  toMatchRow(extraTime).winner_code === "ENG",
);

// (c) complete penalties - winner field is null, shootout folded into fullTime.
const penalties = fd({
  id: 537428,
  status: "FINISHED",
  stage: "LAST_32",
  home: "AUS",
  away: "EGY",
  ft: [3, 5],
  winner: null, // football-data leaves this null on shootouts
  duration: "PENALTY_SHOOTOUT",
});
check("complete penalties 3-5 IS complete", hasCompleteKnockoutResult(penalties));
check(
  "complete penalties derives winner EGY (folded fullTime)",
  toMatchRow(penalties).winner_code === "EGY",
);

// group draw sanity: a level FINISHED group match is a real, complete result.
const groupDraw = fd({
  status: "FINISHED",
  stage: "GROUP_STAGE",
  home: "MEX",
  away: "POL",
  ft: [1, 1],
  winner: "DRAW",
});
check("group draw 1-1 IS complete", hasCompleteKnockoutResult(groupDraw));
check("group draw derives winner null", toMatchRow(groupDraw).winner_code === null);

// ---- Section 2: incident merge replay (Fix A) + limbo selection (Fix B) ----
console.log("\n2. incident merge replay (Fix A) + limbo selection (Fix B)");

// Faithful replay of the route's per-row merge guards (route.ts merge map).
const STATUS_RANK: Record<string, number> = { scheduled: 0, live: 1, final: 2 };
function mergeRow(ex: ExistingMatchState & { status: string }, m: FdMatch) {
  const row = toMatchRow(m);
  if (
    row.status !== "postponed" &&
    ex.status !== "postponed" &&
    STATUS_RANK[row.status] < STATUS_RANK[ex.status]
  ) {
    row.status = ex.status as typeof row.status;
  }
  if (
    row.score_a === null &&
    row.score_b === null &&
    ex.score_a !== null &&
    ex.score_b !== null
  ) {
    row.score_a = ex.score_a;
    row.score_b = ex.score_b;
    row.winner_code = ex.winner_code;
  }
  if (shouldKeepExistingKnockoutResult(m, ex)) {
    row.score_a = ex.score_a;
    row.score_b = ex.score_b;
    row.winner_code = ex.winner_code;
  }
  return row;
}

// DB already has the correct decisive result (final 2-1 ENG); a stale bulk
// payload arrives FINISHED 1-1 with a null winner.
const dbFinal = {
  status: "final",
  score_a: 2,
  score_b: 1,
  winner_code: "ENG",
};
const staleLevel = fd({
  status: "FINISHED",
  stage: "QUARTER_FINALS",
  home: "ENG",
  away: "NOR",
  ft: [1, 1],
  winner: null,
});
const merged = mergeRow(dbFinal, staleLevel);
check(
  "Fix A keeps stored 2-1 ENG against a stale FINISHED 1-1",
  merged.score_a === 2 && merged.score_b === 1 && merged.winner_code === "ENG",
);

// A DECISIVE correction must still flow through (018 self-healing path).
const decisiveCorrection = fd({
  status: "FINISHED",
  stage: "QUARTER_FINALS",
  home: "ENG",
  away: "NOR",
  ft: [3, 4], // away now ahead - a genuine winner correction
  winner: "AWAY_TEAM",
});
const corrected = mergeRow(dbFinal, decisiveCorrection);
check(
  "a decisive correction still flows (2-1 ENG -> 3-4 NOR)",
  corrected.score_a === 3 && corrected.score_b === 4 && corrected.winner_code === "NOR",
);

// Fix B: a winner-null limbo knockout is selected for a detail fetch...
check(
  "Fix B selects a FINISHED level knockout while DB winner is null",
  needsLimboDetailFetch(staleLevel, null),
);
// ...but not once a decisive winner is stored (stop spending calls)...
check(
  "Fix B stops once a decisive winner is stored",
  !needsLimboDetailFetch(staleLevel, "ENG"),
);
// ...and not for a complete result, nor for a group match.
check(
  "Fix B does not select a complete extra-time result",
  !needsLimboDetailFetch(extraTime, null),
);
check(
  "Fix B does not select a group match",
  !needsLimboDetailFetch(groupDraw, null),
);

console.log(
  failures === 0
    ? "\nALL CHECKS PASSED"
    : `\n${failures} CHECK(S) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
