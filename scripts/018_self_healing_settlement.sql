-- ============================================================
-- World Cup Cup - winner-correction healing for settlement (minimal-touch)
--
-- The bug being fixed (SUI/COL r16, match 537382, 2026-07-07): a pick can settle
-- against a winner_code that the feed later CORRECTS. SUI/COL went to penalties;
-- a volatile feed briefly had Colombia ahead, the match settled paying every
-- Colombia pick, then the row corrected to SUI 4-3. Old settlement was one-shot
-- (WHERE settled_at IS NULL), so those payouts froze on the wrong winner.
--
-- CRITICAL CONSTRAINT (learned the hard way): settlement must NEVER retroactively
-- re-price a pick that is still correct. The payout formula has changed over the
-- tournament (002/012 doubling -> 016 return-rate), and picks are GRANDFATHERED
-- at the payout they settled with. A previous version of this function
-- re-evaluated EVERY pick against the CURRENT formula on every call; because the
-- cron calls settle for every finished match every tick, it silently re-priced
-- all historical picks down to the new formula, slashing grandfathered winnings
-- and pushing heavy bettors negative (which the staking budget otherwise makes
-- impossible). Never again: this function only touches a pick whose CORRECTNESS
-- flipped.
--
-- Behavior:
--   * first settlement (settled_at null): pay correct picks the current-era
--     formula, stamp losers at 0.
--   * winner corrected after settlement:
--       - a pick now WRONG but currently paid (>0)  -> set to 0   (flip win->loss)
--       - a pick now CORRECT but currently 0         -> pay it     (flip loss->win)
--   * a pick that is still correct and already paid is LEFT UNTOUCHED, so its
--     grandfathered payout is preserved. A stable final match re-settles to zero
--     row changes.
--   * a stale refund (payout_wcc>0) on a now-final match converts to a real
--     settlement.
--
-- Returns the number of picks actually changed (0 on a steady state).
-- Idempotent: create or replace. Correct-pick payout formula matches 016.
-- ============================================================
create or replace function public.settle_match_picks(target_match_id int)
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  m record;
  changed_count int := 0;
begin
  select id, status, team_a_code, team_b_code, winner_code
    into m from public.wc_matches where id = target_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  if m.status <> 'final' then raise exception 'match is not final'; end if;

  update public.wc_picks p
     set settled_at = coalesce(p.settled_at, now()),
         payout_wcp = case
           when (p.pick = 'A' and m.winner_code = m.team_a_code)
             or (p.pick = 'B' and m.winner_code = m.team_b_code)
             or (p.pick = 'D' and m.winner_code is null)
           then
             -- correct: keep an already-credited (possibly grandfathered) payout;
             -- only compute a payout for a pick being credited for the FIRST time
             -- (initial settlement, or a loss->win flip from a winner correction).
             case when p.payout_wcp > 0 then p.payout_wcp
                  else floor(p.stake * coalesce(p.stake_mult, 1.0) + 0.5)::int + 1 end
           else 0  -- wrong pick pays nothing
         end,
         payout_wcc = 0
   where p.match_id = target_match_id
     and (
       -- first settlement
       p.settled_at is null
       -- flip win -> loss: currently paid but now wrong
       or (p.payout_wcp > 0 and not (
             (p.pick = 'A' and m.winner_code = m.team_a_code)
          or (p.pick = 'B' and m.winner_code = m.team_b_code)
          or (p.pick = 'D' and m.winner_code is null)))
       -- flip loss -> win: currently zero but now correct
       or (p.payout_wcp = 0 and (
             (p.pick = 'A' and m.winner_code = m.team_a_code)
          or (p.pick = 'B' and m.winner_code = m.team_b_code)
          or (p.pick = 'D' and m.winner_code is null)))
       -- stale refund on a now-final match
       or p.payout_wcc <> 0
     );

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;
