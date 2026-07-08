-- ============================================================
-- World Cup Cup - self-healing settlement
--
-- The bug this fixes (SUI/COL r16, match 537382, 2026-07-07):
-- settlement was ONE-SHOT (WHERE settled_at IS NULL), so a pick paid out on
-- whatever winner_code the match row carried at the FIRST tick it went final -
-- and then stayed frozen even when football-data later CORRECTED the winner.
-- SUI/COL went to penalties; a volatile feed briefly had Colombia ahead, the
-- match settled paying every Colombia pick, then the row corrected to SUI 4-3.
-- The picks stayed locked on the wrong winner: the UI read winner=SUI while the
-- WCC totals rode Colombia-win payouts. (Same class as POR/CRO 537419.)
--
-- The existing guards only stop settling on a NULL winner (phantom draw). They
-- can't stop settling on a wrong-but-DECISIVE winner, because at that instant it
-- looks like a legitimate result. Upstream feeds are unreliable, so instead of
-- trying to enumerate every way a wrong winner slips in, settlement now FOLLOWS
-- the current best-known winner and re-converges when it changes.
--
-- How: this RPC re-evaluates EVERY pick on the match against the match's current
-- winner_code on each call, and rewrites payout_wcp for any pick whose payout no
-- longer matches. settled_at is stamped once (coalesce) and never cleared, so the
-- stake-spent accounting is stable; only the winnings move. The cron already
-- calls settle_match_picks for every football-data-final match every tick, so a
-- corrected winner now self-heals within one tick with no manual intervention.
--
-- Returns the number of picks whose payout actually changed (0 on a steady
-- state), so a routine tick over an unchanged final match does no writes.
--
-- Idempotent: create or replace. Payout formula unchanged from 016
-- (floor(stake * stake_mult + 0.5) + 1 on a correct pick, else 0).
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
         payout_wcp = e.expected,
         -- A pick being settled/re-settled is a decided result, never a refund.
         -- Clearing payout_wcc also converts a stale postponed-refund into a
         -- real settlement if a match went postponed -> final.
         payout_wcc = 0
    from (
      -- wc_picks is keyed by (user_id, match_id); scoped to one match here, so
      -- user_id alone rejoins each pick to its freshly-computed expected payout.
      select
        pk.user_id,
        case
          when pk.pick = 'A' and m.winner_code = m.team_a_code
            then floor(pk.stake * coalesce(pk.stake_mult, 1.0) + 0.5)::int + 1
          when pk.pick = 'B' and m.winner_code = m.team_b_code
            then floor(pk.stake * coalesce(pk.stake_mult, 1.0) + 0.5)::int + 1
          when pk.pick = 'D' and m.winner_code is null
            then floor(pk.stake * coalesce(pk.stake_mult, 1.0) + 0.5)::int + 1
          else 0
        end as expected
      from public.wc_picks pk
      where pk.match_id = target_match_id
    ) e
   where p.match_id = target_match_id
     and p.user_id = e.user_id
     and (
       p.settled_at is null
       or p.payout_wcp is distinct from e.expected
       or p.payout_wcc <> 0
     );

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;
