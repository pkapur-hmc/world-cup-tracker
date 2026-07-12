-- ============================================================
-- World Cup Cup - staking payout: multiplier IS the stake return rate
--
-- Old: a correct pick paid (1 + 2*stake) * stake_mult - the multiplier scaled
-- the base 2x doubling, so a 500 stake at 1.1x returned ~1100. That over-rewarded
-- staking and double-counted the base odds.
--
-- New: a correct pick returns floor(stake * stake_mult) + 1.
--   - stake 500 @ 1.1x -> 551 back (net +51)
--   - stake 500 @ 2.0x -> 1001 (net +501)
--   - stake 500 @ 1.0x (leader) -> 501 (net +1, ~break even)
--   - stake 0 (any) -> 1 (net +1, the correct-call reward)
-- The +1 keeps a no-stake correct pick worth something. Wrong picks lose the
-- stake (unchanged). settle reads whatever stake_mult is stored: as of
-- scripts/019 that is the rate LOCKED AT KICKOFF (the placement-time stamp is
-- only a provisional preview), so the rate a player has when bets lock is the
-- rate they're paid. Only affects picks settled AFTER this.
--
-- Idempotent: create or replace; only touches unsettled picks.
-- ============================================================
create or replace function public.settle_match_picks(target_match_id int)
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  m record;
  settled_count int := 0;
begin
  select id, status, team_a_code, team_b_code, winner_code
    into m from public.wc_matches where id = target_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  if m.status <> 'final' then raise exception 'match is not final'; end if;

  update public.wc_picks p
     set settled_at = now(),
         payout_wcp = case
           when p.pick = 'A' and m.winner_code = m.team_a_code
             then floor(p.stake * coalesce(p.stake_mult, 1.0) + 0.5)::int + 1
           when p.pick = 'B' and m.winner_code = m.team_b_code
             then floor(p.stake * coalesce(p.stake_mult, 1.0) + 0.5)::int + 1
           when p.pick = 'D' and m.winner_code is null
             then floor(p.stake * coalesce(p.stake_mult, 1.0) + 0.5)::int + 1
           else 0
         end,
         payout_wcc = 0
   where p.match_id = target_match_id
     and p.settled_at is null;

  get diagnostics settled_count = row_count;
  return settled_count;
end;
$$;
