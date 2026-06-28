-- ============================================================
-- World Cup Cup - comeback multiplier (#6): apply the stake multiplier at settle
--
-- A correct pick now pays floor((1 + 2*stake) * stake_mult + 0.5). stake_mult was
-- snapshotted onto the pick at placement (place_pick), so the payout honors the
-- multiplier the player saw when betting - never recomputed against later
-- standings. Picks placed before the flip carry stake_mult = 1.0 -> unchanged.
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
             then floor((1 + 2 * p.stake) * coalesce(p.stake_mult, 1.0) + 0.5)::int
           when p.pick = 'B' and m.winner_code = m.team_b_code
             then floor((1 + 2 * p.stake) * coalesce(p.stake_mult, 1.0) + 0.5)::int
           when p.pick = 'D' and m.winner_code is null
             then floor((1 + 2 * p.stake) * coalesce(p.stake_mult, 1.0) + 0.5)::int
           else 0
         end,
         payout_wcc = 0
   where p.match_id = target_match_id
     and p.settled_at is null;

  get diagnostics settled_count = row_count;
  return settled_count;
end;
$$;
