# Plan: fix the extra-time "phantom draw" limbo + repair the two QF matches

Written 2026-07-12 after investigating the NOR/ENG (537385) and ARG/SUI (537386)
quarterfinals. This plan is for an implementing agent (Opus). Read the whole
"Understanding" section before touching code - every previous fix failed because
it patched one observed symptom without the full football-data lifecycle model.

---

## 1. What the user saw

Both QFs on 2026-07-11/12 showed as a 1-1 **draw** on their match cards while
the semifinal fixture (537388) simultaneously showed ENG and ARG advancing.
Picks did not settle until 06:09 UTC, ~6 hours after the matches ended.

## 2. Current DB state (verified 2026-07-12 ~14:30 UTC)

- Both match rows are now CORRECT and self-healed: 537385 NOR 1-2 ENG,
  winner ENG; 537386 ARG 3-1 SUI, winner ARG. Status final.
- All picks on both matches settled at 06:09:03 UTC with the CORRECT winner
  and correct payout formula (floor(stake * stake_mult + 0.5) + 1 for winners,
  0 for losers). Nothing settled as a draw.
- The residual damage is ONLY the stale multiplier stamps described in section 6.
  Do not re-settle these matches wholesale.

## 3. How football-data v4 actually encodes results (verified against live API)

For a knockout match that goes past 90 minutes, the FINAL payload looks like:

```
// 537385 ENG win in extra time            // 537428 AUS/EGY, penalties
"status": "FINISHED",                       "status": "FINISHED",
"score": {                                  "score": {
  "winner": "AWAY_TEAM",                      "winner": "AWAY_TEAM",
  "duration": "EXTRA_TIME",                   "duration": "PENALTY_SHOOTOUT",
  "fullTime":    { 1, 2 },                    "fullTime":    { 3, 5 },   // regular+ET+pens FOLDED
  "regularTime": { 1, 1 },                    "regularTime": { 1, 1 },
  "extraTime":   { 0, 1 }                     "extraTime":   { 0, 0 },
}                                             "penalties":   { 2, 4 }
                                            }
```

Key facts, all confirmed by live payloads:
- `fullTime` is the cumulative final total: regular + extra time, and for
  shootouts the penalty goals are folded in too. Once the data is COMPLETE,
  deriving the winner from `fullTime` (current toMatchRow logic) is correct.
- **Finalization is NOT atomic.** The fields land in stages, and the free tier
  serves stale replicas, so consumers observe intermediate states in any order:
  1. `status` flips to FINISHED first, sometimes with `fullTime` still holding
     only the REGULATION score (1-1 for both QFs) and `winner` null/absent.
  2. The extraTime/penalties breakdown and the corrected `fullTime` land later -
     in this incident ~6 hours later on the bulk feed.
  3. `winner` lands last.
- The bulk competition feed (`/competitions/WC/matches`) lags the single-match
  detail endpoint (`/matches/{id}`) and sometimes omits `fullTime` entirely on
  FINISHED matches.
- Consequence: **`FINISHED` + a level `fullTime` on a knockout match is ALWAYS
  an incomplete-finalization artifact**, never a real result. Knockouts cannot
  end level. This is the invariant every fix below builds on.

## 4. The failure sequence on 2026-07-11 (why the draw appeared)

1. Match ends 1-1 after 90', goes to extra time. The ESPN overlay tracks the
   real score through ET; at the true final whistle ESPN state=post gives the
   decisive score, and the sync marks the row final with the right winner
   (route.ts espn_finals path, lines ~194-202).
2. football-data's feed then serves `FINISHED` with `fullTime` = the regulation
   1-1 (stage 1 of finalization). `toMatchRow` derives: score 1-1, winner null.
   The sync's guards do not catch this: the null-score guard (route.ts ~137-147)
   only protects against NULL scores, not a stale non-null LEVEL score. The 1-1
   **clobbers the correct decisive score already in the DB.** Row is now:
   final, 1-1, winner_code null -> UI renders "Draw".
3. Nothing can repair the row until football-data itself corrects:
   - The ESPN overlay skips any row with status final (route.ts ~170).
   - The detail-endpoint backfill skips it twice over: needsDetail requires
     bulk `fullTime` null (it was 1-1, non-null), and even when null,
     `scoreKnown(id)` is true because the DB has 1-1 (route.ts ~62-74).
   - The winner safety net (~218-229) only fires on decisive scores.
4. Settlement gate 3 (knockout + winner_code null) correctly BLOCKED settlement,
   so no draw payout happened - the gates from the previous four incidents
   worked. But the row sat in limbo showing a draw until football-data's bulk
   feed finally served the complete fullTime (~06:09 UTC), at which point score,
   winner, and settlement all landed correctly on one tick.
5. Meanwhile football-data had already filled the semifinal team slots, so the
   app showed ENG/ARG advancing next to a "draw" - exactly what the user saw.

## 5. Why four previous fixes did not prevent this

Each fix hardened the SETTLEMENT layer against one observed intermediate state
(null score -> gate 2; null winner mid-VAR -> gate 3; pens folded into fullTime
-> fullTime-derived winner; late winner correction -> 018 self-healing). They
worked: no wrong payout this time. What nobody fixed is the ROW state machine:
a stale fd response can still overwrite better data, and the resulting
"final + level score on a knockout" state has no owner - every repair mechanism
is disqualified from touching it (see 4.3). The fix must make that state
(a) unreachable via the clobber guard and (b) self-repairing via the detail
endpoint if it is ever reached.

## 6. Residual data damage: stale stake_mult on 3 picks

`place_pick` (scripts/011, line ~230) stamps `stake_mult` from the
`wc_user_scores` snapshot at pick time. That snapshot only moves when
settlements land (cron calls `wc_refresh_user_scores` each tick). Because
537385 settled 6h late, picks placed AFTER its real final whistle carry
multipliers that ignore its outcome.

Verified blast radius (queried wc_picks and wc_comeback_bonus across the full
stale window 2026-07-11T23:45Z -> 2026-07-12T06:10Z):
- Exactly 3 picks affected, all on 537386 (ARG/SUI), all pick=A (Argentina,
  the eventual winner):

  | user | picked_at (UTC) | stake | stamped mult | payout paid |
  |---|---|---|---|---|
  | 7f94978e-c95d | 07-12 00:56:51 | 500 | 1.1 | 551 |
  | ba250a39-a0e6 | 07-12 00:57:03 | 438 | 2.0 | 877 |
  | 77359637-6ce3 | 07-12 00:58:20 | 0   | 1.8 | 1   |

- No drinks / comeback bonuses were logged in the window (verified empty), so
  beer_mult/passport_mult contamination is zero.
- The other two QFs settled 6 minutes after their whistles (537383 at 07-09
  22:06, 537384 at 07-10 21:06), so the ENG/NOR picks' own multiplier stamps
  are clean. The damage does not recurse further back within the QF round.
- 537385 (ENG/NOR) itself needs NO pick changes: winner ENG, all B picks paid,
  all A picks zeroed, formula verified against the data.

## 7. Data repair (do this FIRST, ordered, before code changes)

The ordering requirement: 537385's outcome must be reflected in user scores
BEFORE recomputing anything about 537386, because the multiplier is a function
of each user's WCC and the global leader at pick time. Concretely the order is
honored inside the counterfactual reconstruction below.

Write ONE script `scripts/fix-qf-stale-mults.mjs` following the repo's existing
one-off script conventions (see scripts/resettle-537382.mjs and
fix-537428-winner.mjs): dotenv from .env.local, service-role Supabase client,
`--apply` flag with dry-run default, and a JSON backup written to
`scripts/537386-stale-mult-backup.json` before any write.

Step 1 - assert 537385 is healthy (abort loudly if not):
  - wc_matches row: status final, winner_code ENG, score 1-2.
  - every pick: settled, winners paid floor(stake*mult+0.5)+1, losers 0,
    payout_wcc 0.

Step 2 - reconstruct the counterfactual snapshot at T = 2026-07-12T00:56:00Z
"as if 537385 had settled on time". For EVERY user with a wc_memberships row,
compute as_of_wcc mirroring `wc_compute_user_wcc` (scripts/010, lines 130-165)
term by term, but time-filtered:
  - drinks earned: wc_drinks with created_at <= T
    (1 per null-country row, 2 per country row).
  - picks: treat as settled the set {picks with real settled_at <= T} UNION
    {all picks on 537385}. For that set: subtract stake, add payout_wcc +
    payout_wcp. For 537385 picks use their CURRENT (correct) payout values.
    Do NOT include 537386 picks (unsettled at T - the match had not kicked off).
  - passport depth/breadth bonuses: recompute the +5 terms from drinks with
    created_at <= T (same shape as the SQL).
  - comeback bonus extras: wc_comeback_bonus with created_at <= T.
  - adjustments: wc_score_adjustments with created_at <= T.
  Then leader = max(as_of_wcc) across all users, and per user
  `stake_mult = (11 + round(9 * deficit_ratio(wcc, leader))) / 10` where
  `deficit_ratio(s, l) = min(max(1 - max(s,0)/l, 0) / 0.9, 1) ^ 2`
  (this is the CURRENT curve, scripts/017 - not the older 010/015 curves).
  Round exactly like SQL `round()` (half away from zero).
  All three picks share one T because nothing that moves scores happened
  between 00:56 and 00:58 (verified: no drinks, no settlements in that gap).

Step 3 - print a before/after table for the 3 picks: stamped mult vs
counterfactual mult, and payout 551/877/1 vs recomputed
floor(stake * new_mult + 0.5) + 1 (all three picked the winner, so the winner
formula applies to all three). Expected direction, to sanity-check the output:
ba250a39 stays at the 2.0 cap (they LOST 20 on ENG/NOR); 77359637's mult drops
(they netted +560 on ENG/NOR) but stake 0 keeps payout at 1; 7f94978e stays 1.1
or ticks up one step only if the leader's own ENG/NOR winnings moved the anchor.
If the script computes something wildly different, stop and investigate.

Step 4 - with --apply: write backup JSON, then UPDATE only stake_mult and
payout_wcp on the 3 rows (leave settled_at, payout_wcc untouched), then call
`wc_refresh_user_scores(null)` once, then re-print the rows.

Do NOT call settle_match_picks for this repair - it deliberately never
re-prices a still-correct paid pick (grandfathering, see 018 header), so it
would be a no-op. Direct UPDATE is the intended path for a manual correction.

## 8. Code fixes (ship before the semifinals, first is 2026-07-14 19:00 UTC)

Both semis and the final are knockout matches with a high chance of ET/pens;
this exact failure will recur on them without these changes.

### Fix A (core) - stale-level clobber guard in the sync
In route.ts where the per-row guards run (~lines 128-148): if the EXISTING DB
row has a decisive score and non-null winner_code, and the row is a knockout
stage (stage !== "group"), and the INCOMING row has a level or null score, keep
the existing score_a/score_b/winner_code. Rationale: a knockout cannot end
level, so an incoming level score can only be finalization-stage-1 garbage.
IMPORTANT: an incoming DECISIVE score must still flow through even when it
differs from the stored one - that is the legitimate winner-correction path
that 018 self-healing depends on (SUI/COL incident). Only level/null gets
rejected.

### Fix B - detail-endpoint rescue for limbo knockouts
In the needsDetail selection (~lines 62-80): additionally qualify any match
where fd status is FINISHED/AWARDED, stage maps to a knockout, and the fd bulk
payload does NOT yield a decisive fullTime (null OR level) - REGARDLESS of
scoreKnown, but ONLY while the DB row's winner_code is null (once a decisive
winner is stored, stop spending calls). Sort these at the front of the budget
queue. The detail endpoint finalizes sooner than the bulk feed and carries
duration/regularTime/extraTime/penalties; this turns a 6-hour limbo into
minutes. Budget stays 8; at most 1-2 knockout matches per day can be in this
state so it cannot starve the live backfills for long.

### Fix C - let the ESPN overlay repair limbo rows
The overlay currently skips every final row (~line 170). Change the skip to:
skip if status final AND NOT (knockout stage with winner_code null). That lets
ESPN keep writing the true running/final score to a limbo row. Two conscious
consequences to preserve and document in comments:
- For ET matches ESPN's post score equals fd's eventual fullTime, so the row
  (and settlement, once fd says FINISHED) is correct hours earlier.
- For shootouts ESPN's score stays level (pens are separate in its payload),
  winner_code stays null, and settlement stays blocked by gate 3 until fd
  delivers - unchanged, safe behavior.

### Fix D - centralize the invariant + fix the misleading comment
Add to lib/football-data.ts an exported predicate, e.g.
`hasCompleteKnockoutResult(m: FdMatch): boolean` = status FINISHED/AWARDED,
fullTime non-null, and (stage GROUP_STAGE or fullTime decisive). Use it in
Fixes A/B rather than re-deriving the condition inline twice. Extend the
comment block at FdMatch.score / toMatchRow with the lifecycle model from
section 3 of this plan - in particular that `fullTime` itself is transiently
WRONG (regulation-only, level) on FINISHED knockouts, which the current comment
("robust to the transient null winner") does not cover. Keep the existing
fullTime-derived winner logic - it is correct once data is complete, including
the folded-penalties case (re-confirmed on 537428 today).

### Explicitly out of scope / do NOT do
- Do not touch settle_match_picks (018) or the payout formula. The settlement
  gates and grandfathering are correct and battle-tested; the bug is upstream.
- Do not re-price or re-settle any pick outside the 3 listed in section 7.
- Do not switch settlement to ESPN or change gate 1/2/3 semantics.
- No schema changes are needed. The only DB writes are the section 7 repair.

## 9. Verification

1. Unit-style check of the mappers if the repo grows a test entry point;
   otherwise a scripts/ dry-run harness is fine: feed toMatchRow +
   hasCompleteKnockoutResult the three real payload shapes from section 3
   (regulation-only FINISHED 1-1, complete ET, complete pens) and assert
   incomplete/complete classification and derived winners.
2. Replay the incident locally: simulate DB row = final 2-1 ENG winner, incoming
   bulk = FINISHED 1-1 null-winner, assert the merged row keeps 2-1 ENG (Fix A),
   and that needsDetail selects the match when DB winner is null (Fix B).
3. Run the section 7 script dry-run, eyeball the table, then --apply, then
   verify wc_user_scores totals moved only for the 3 users (and anyone whose
   rank the leader shift touches via multipliers, which refresh recomputes).
4. Deploy, then watch the next cron tick response JSON (detail_fetches,
   espn_overlays, picks_settled) to confirm nothing regressed on the already-
   final fixture set (settled should be 0 changed rows steady-state).
