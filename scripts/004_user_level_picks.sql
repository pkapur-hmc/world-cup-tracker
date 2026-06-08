-- ============================================================
-- World Cup Cup - Phase 2: user-level picks
--
-- Picks were originally per-(group, user, match) so a user could pick
-- differently in each bracket. The product call is now: one pick per
-- (user, match), and that pick is the user's pick in EVERY bracket they
-- belong to. "track once, your numbers show everywhere".
--
-- This migration:
--   1. Dedupes any existing picks per (user_id, match_id), keeping the
--      most recent picked_at.
--   2. Swaps the primary key from (group_id, user_id, match_id) to
--      (user_id, match_id). group_id stays as a denormalized "last touched
--      from this bracket" hint - it doesn't gate anything in stats.
--   3. Rewrites place_pick so it (a) computes available WCC user-wide
--      across all the user's brackets, and (b) upserts on (user_id, match_id).
--   4. Loosens the SELECT RLS policy so a member of bracket A can read the
--      pick belonging to a user who is in bracket A AND made the pick from
--      bracket B - otherwise leaderboards in B can't see picks made from A.
--      The condition stays group-shared: you can read picks of any user
--      with whom you share AT LEAST one bracket.
-- ============================================================

-- 1) Dedupe ---------------------------------------------------
delete from public.wc_picks p1
using public.wc_picks p2
where p1.user_id = p2.user_id
  and p1.match_id = p2.match_id
  and (
       p1.picked_at < p2.picked_at
    or (p1.picked_at = p2.picked_at and p1.ctid < p2.ctid)
  );

-- 2) Swap primary key ----------------------------------------
alter table public.wc_picks drop constraint if exists wc_picks_pkey;
alter table public.wc_picks add primary key (user_id, match_id);

-- 3) Rewrite place_pick --------------------------------------
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

  -- User-wide balance. drinks/picks both ignore group_id now.
  --   earned   = count of all drinks (basic) + 2*country beers
  --   spent    = sum(stake) on picks for OTHER matches
  --   refunds  = sum(payout_wcc) on settled refunded picks
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
    (select coalesce(sum(payout_wcc), 0) from public.wc_picks
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

-- 4) Loosen SELECT RLS --------------------------------------
drop policy if exists "picks readable by group members" on public.wc_picks;
drop policy if exists "picks readable by shared bracket" on public.wc_picks;
create policy "picks readable by shared bracket" on public.wc_picks
  for select to authenticated
  using (
    -- own picks
    user_id = auth.uid()
    or
    -- someone whose pick you can see because you share at least one bracket
    exists (
      select 1
        from public.wc_memberships m1
        join public.wc_memberships m2 on m1.group_id = m2.group_id
       where m1.user_id = auth.uid()
         and m2.user_id = wc_picks.user_id
    )
  );
