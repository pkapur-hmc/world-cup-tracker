-- ============================================================
-- World Cup Cup - passport bonuses (depth + breadth)
--
-- Two new WCC bonuses, both derived from raw wc_drinks rows in the app
-- (lib/scoring.ts), so no data migration is needed and prior progress counts:
--   - DEPTH:   stamp EVERY beer on a country's curated list -> +5 WCC, per
--              country (complete Mexico AND Brazil = +10). Flat regardless of
--              list size.
--   - BREADTH: +5 WCC for every 5 distinct countries you've stamped at least
--              once (a width incentive to counterweight deep completion).
--
-- This script keeps the SERVER's stake budget in agreement (the depth bonus
-- needs to know each country's list size; breadth is pure count):
--
--   1. wc_passport_requirements: how many distinct beers each country's list
--      has. Seeded from data/country-beers.ts - regenerate if that file's
--      lists change:
--        npx tsx -e "import {COUNTRY_BEERS} from './data/country-beers';
--          console.log(Object.entries(COUNTRY_BEERS).map(([c,b])=>
--          \`('\${c}', \${b.length})\`).sort().join(',\n'))"
--   2. place_pick: available WCC now includes +5 per completed passport.
--
-- Idempotent: safe to re-run (requirements are upserted).
-- ============================================================

create table if not exists public.wc_passport_requirements (
  country_code text primary key references public.wc_teams(code),
  beer_count int not null check (beer_count > 0)
);

alter table public.wc_passport_requirements enable row level security;

drop policy if exists "passport requirements readable" on public.wc_passport_requirements;
create policy "passport requirements readable"
  on public.wc_passport_requirements for select to authenticated using (true);

insert into public.wc_passport_requirements (country_code, beer_count) values
  ('ALG', 3),
  ('ARG', 5),
  ('AUS', 6),
  ('AUT', 5),
  ('BEL', 6),
  ('BIH', 4),
  ('BRA', 5),
  ('CAN', 5),
  ('CIV', 3),
  ('COD', 4),
  ('COL', 5),
  ('CPV', 1),
  ('CRO', 5),
  ('CUW', 3),
  ('CZE', 4),
  ('ECU', 3),
  ('EGY', 3),
  ('ENG', 6),
  ('ESP', 6),
  ('FRA', 4),
  ('GER', 6),
  ('GHA', 4),
  ('HAI', 1),
  ('IRN', 3),
  ('IRQ', 3),
  ('JOR', 3),
  ('JPN', 5),
  ('KOR', 4),
  ('KSA', 3),
  ('MAR', 4),
  ('MEX', 6),
  ('NED', 5),
  ('NOR', 5),
  ('NZL', 5),
  ('PAN', 4),
  ('PAR', 3),
  ('POR', 4),
  ('QAT', 3),
  ('RSA', 4),
  ('SCO', 5),
  ('SEN', 3),
  ('SUI', 4),
  ('SWE', 4),
  ('TUN', 2),
  ('TUR', 3),
  ('URY', 4),
  ('USA', 6),
  ('UZB', 3)
on conflict (country_code) do update set beer_count = excluded.beer_count;

-- ============================================================
-- place_pick: stake budget now includes passport bonuses
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
  --   earned    = all basic drinks + 2 * country beers
  --   spent     = sum(stake) on picks for OTHER matches
  --   settled   = refunds (payout_wcc) + winnings (payout_wcp)
  --   depth     = +5 per country whose full beer list has been stamped
  --   breadth   = +5 for every 5 distinct countries stamped
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
    +
    (select coalesce(5 * count(*), 0) from (
       select d.country_code
         from public.wc_drinks d
         join public.wc_passport_requirements r on r.country_code = d.country_code
        where d.user_id = auth.uid() and d.beer_label is not null
        group by d.country_code, r.beer_count
       having count(distinct d.beer_label) >= r.beer_count
     ) completed)
    +
    (select ((count(distinct country_code) / 5) * 5)::int
       from public.wc_drinks
       where user_id = auth.uid()
         and country_code is not null
         and beer_label is not null)
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
