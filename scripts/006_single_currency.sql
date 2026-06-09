-- ============================================================
-- World Cup Cup - single-currency consolidation
--
-- Product change: collapse the two-currency model (WCC balance + WCP score)
-- into ONE currency, WCC. The leaderboard now ranks on a single number that is
-- both your spendable balance and your score:
--
--   WCC = drinks (basic +1, country beer +2)
--         - stakes spent
--         + refunds (payout_wcc, on postponed matches)
--         + pick winnings (payout_wcp, 1 + 2*stake on a correct pick)
--
-- The wc_picks.payout_wcp column is kept as-is (settle_match_picks still writes
-- the winnings there); the app just reads it as plain WCC. No data migration is
-- required - this only redefines place_pick so the stake budget matches the new
-- "one pool" rule: you can stake ANY WCC you hold, including pick winnings.
--
-- Idempotent: safe to re-run.
-- ============================================================

create or replace function public.place_pick(
  target_group_id uuid,
  target_match_id int,
  pick_value text,
  stake_value int default 0
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  m record;
  available_wcc int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not public.is_group_member(target_group_id) then
    raise exception 'not a member of this bracket';
  end if;
  if pick_value not in ('A','D','B') then raise exception 'invalid pick'; end if;
  if stake_value < 0 then raise exception 'stake must be >= 0'; end if;

  select id, stage, kickoff_at, status
    into m from public.wc_matches where id = target_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  if m.stage <> 'group' and pick_value = 'D' then
    raise exception 'draw picks not allowed in knockout matches';
  end if;
  if now() > m.kickoff_at + interval '30 seconds' then
    raise exception 'picks are locked';
  end if;

  -- Single WCC pool (user-wide; drinks/picks ignore group_id):
  --   earned   = all basic drinks + 2 * country beers
  --   spent    = sum(stake) on picks for OTHER matches
  --   refunds  = sum(payout_wcc) on settled refunded picks
  --   winnings = sum(payout_wcp) on settled correct picks   <-- now stakeable
  select
    (select count(*) filter (where country_code is null)
        + 2 * count(*) filter (where country_code is not null)
       from public.wc_drinks
       where user_id = auth.uid())
    -
    (select coalesce(sum(stake), 0) from public.wc_picks
       where user_id = auth.uid()
         and match_id <> target_match_id)
    +
    (select coalesce(sum(payout_wcc) + sum(payout_wcp), 0) from public.wc_picks
       where user_id = auth.uid()
         and settled_at is not null)
  into available_wcc;

  if stake_value > available_wcc then
    raise exception 'stake exceeds available WCC (% available)', available_wcc;
  end if;

  insert into public.wc_picks (group_id, user_id, match_id, pick, stake, picked_at)
  values (target_group_id, auth.uid(), target_match_id, pick_value, stake_value, now())
  on conflict (user_id, match_id)
  do update set
    group_id = excluded.group_id,
    pick = excluded.pick,
    stake = excluded.stake,
    picked_at = now()
  where wc_picks.settled_at is null;
end;
$$;
