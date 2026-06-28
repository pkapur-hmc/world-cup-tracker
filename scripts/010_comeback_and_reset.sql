-- ============================================================
-- World Cup Cup - comeback multiplier (#6) + soft reset (#9): tables & helpers
--
-- ADDITIVE model: today's derived WCC (country=2, basic=1, depth/breadth +5,
-- picks 1+2*stake) stays the BASE, untouched. We only ADD:
--   - wc_comeback_bonus : the EXTRA points the beer/passport multiplier creates
--                         on NEW events (stored = awarded - flat base).
--   - wc_score_adjustments : reversible score nudges (the one-time soft reset).
-- Stake winnings carry their multiplier inside wc_picks.payout_wcp (settlement).
--
-- All new tables start EMPTY, so totals are unchanged at launch by construction.
-- Nothing here changes behavior until scripts/013 flips multiplier_enabled.
--
-- Multiplier tiers (discrete), anchored to the current GLOBAL leader:
--   ratio        = clamp(1 - score/leader, 0, 1)        -- 0 at leader, 1 at score 0
--   beer_mult     = clamp(round(1 + 9*ratio), 1, 10)    -- integer 1..10  (beer 2 -> 4..20)
--   passport_mult = 1 + round(8*ratio)/2                -- 0.5 steps 1..5 (bonus 5 -> 5..25)
--   stake_mult    = 1 + round(10*ratio)/10              -- 0.1 steps 1..2 (winnings up to 2x)
-- WCC stays integer via half-up rounding: floor(base*mult + 0.5).
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ---------- feature flag ----------
create table if not exists public.wc_settings (
  key   text primary key,
  value text not null
);
alter table public.wc_settings enable row level security;
drop policy if exists "settings readable" on public.wc_settings;
create policy "settings readable" on public.wc_settings
  for select to authenticated using (true);
-- no write policy: only service role / SECURITY DEFINER functions write
insert into public.wc_settings (key, value) values ('multiplier_enabled', 'false')
  on conflict (key) do nothing;

-- ---------- comeback bonus ledger (EXTRA points only) ----------
create table if not exists public.wc_comeback_bonus (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  group_id     uuid,
  kind         text not null check (kind in ('country_beer','passport_depth','passport_breadth')),
  base_wcc     int  not null,                          -- 2 (beer) or 5 (passport): the flat base, for display
  mult         numeric(4,1) not null,                  -- snapped multiplier at earn time
  bonus_wcc    int  not null,                          -- awarded - base (the EXTRA only)
  drink_id     uuid references public.wc_drinks(id) on delete cascade,
  country_code text,
  match_id     int,
  created_at   timestamptz not null default now()
);
create index if not exists idx_wc_comeback_user on public.wc_comeback_bonus(user_id);
create index if not exists idx_wc_comeback_user_match on public.wc_comeback_bonus(user_id, match_id);
-- one depth bonus per (user, country); one breadth bonus per (user, milestone index)
create unique index if not exists wc_comeback_depth_uq
  on public.wc_comeback_bonus(user_id, country_code) where kind = 'passport_depth';
create unique index if not exists wc_comeback_breadth_uq
  on public.wc_comeback_bonus(user_id, country_code) where kind = 'passport_breadth';
-- (breadth stores the milestone index in country_code text, so the same unique shape works)

alter table public.wc_comeback_bonus enable row level security;
drop policy if exists "comeback readable by shared bracket" on public.wc_comeback_bonus;
create policy "comeback readable by shared bracket" on public.wc_comeback_bonus
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.wc_memberships m1
        join public.wc_memberships m2 on m1.group_id = m2.group_id
       where m1.user_id = auth.uid() and m2.user_id = wc_comeback_bonus.user_id
    )
  );
-- no write policy: only log_pour / undo_pour (SECURITY DEFINER) write

-- ---------- reversible score adjustments (soft reset) ----------
create table if not exists public.wc_score_adjustments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  reason     text not null,
  delta      int  not null,
  batch_id   uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wc_score_adj_user on public.wc_score_adjustments(user_id);
create index if not exists idx_wc_score_adj_batch on public.wc_score_adjustments(batch_id);

alter table public.wc_score_adjustments enable row level security;
drop policy if exists "adjustments readable by shared bracket" on public.wc_score_adjustments;
create policy "adjustments readable by shared bracket" on public.wc_score_adjustments
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.wc_memberships m1
        join public.wc_memberships m2 on m1.group_id = m2.group_id
       where m1.user_id = auth.uid() and m2.user_id = wc_score_adjustments.user_id
    )
  );

-- ---------- multiplier snapshot ----------
create table if not exists public.wc_user_scores (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  wcc           int not null default 0,
  beer_mult     numeric(4,1) not null default 1.0,
  passport_mult numeric(4,1) not null default 1.0,
  stake_mult    numeric(4,1) not null default 1.0,
  updated_at    timestamptz not null default now()
);
alter table public.wc_user_scores enable row level security;
drop policy if exists "scores readable by shared bracket" on public.wc_user_scores;
create policy "scores readable by shared bracket" on public.wc_user_scores
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.wc_memberships m1
        join public.wc_memberships m2 on m1.group_id = m2.group_id
       where m1.user_id = auth.uid() and m2.user_id = wc_user_scores.user_id
    )
  );

-- ---------- stake multiplier snapshot column on picks ----------
alter table public.wc_picks
  add column if not exists stake_mult numeric(4,1) not null default 1.0;

-- ============================================================
-- wc_compute_user_wcc: today's derived WCC + comeback extras + adjustments.
-- Mirrors lib/scoring.ts wccTotal exactly for the base, then adds the two
-- new sources. payout_wcp already carries the stake multiplier post-settlement.
-- ============================================================
create or replace function public.wc_compute_user_wcc(target uuid)
returns int
language sql
security definer
set search_path = public, auth
as $$
  select (
    -- earned: basic 1 + country 2 (flat base)
    (select count(*) filter (where country_code is null)
        + 2 * count(*) filter (where country_code is not null)
       from public.wc_drinks where user_id = target)
    -- minus stakes spent (settled only)
    - (select coalesce(sum(stake), 0) from public.wc_picks
         where user_id = target and settled_at is not null)
    -- plus refunds + winnings (settled)
    + (select coalesce(sum(payout_wcc) + sum(payout_wcp), 0) from public.wc_picks
         where user_id = target and settled_at is not null)
    -- depth bonus: +5 per completed country passport (flat base)
    + (select coalesce(5 * count(*), 0) from (
         select d.country_code
           from public.wc_drinks d
           join public.wc_passport_requirements r on r.country_code = d.country_code
          where d.user_id = target and d.beer_label is not null
          group by d.country_code, r.beer_count
         having count(distinct d.beer_label) >= r.beer_count
       ) completed)
    -- breadth bonus: +5 per 5 distinct countries stamped (flat base)
    + (select ((count(distinct country_code) / 5) * 5)::int
         from public.wc_drinks
        where user_id = target and country_code is not null and beer_label is not null)
    -- comeback bonus EXTRAS (new multiplied earnings)
    + (select coalesce(sum(bonus_wcc), 0) from public.wc_comeback_bonus where user_id = target)
    -- reversible score adjustments (soft reset)
    + (select coalesce(sum(delta), 0) from public.wc_score_adjustments where user_id = target)
  )::int;
$$;

-- ============================================================
-- wc_refresh_user_scores: recompute wcc + multipliers for some users (or all).
-- Multipliers anchor to the GLOBAL leader (max wcc across everyone). While
-- multiplier_enabled is false, all mults are pinned to 1.0 (so nothing changes).
-- ============================================================
create or replace function public.wc_refresh_user_scores(targets uuid[] default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  leader  numeric;
  enabled boolean;
begin
  select (value = 'true') into enabled from public.wc_settings where key = 'multiplier_enabled';
  enabled := coalesce(enabled, false);

  -- 1. refresh wcc for targeted users (or every member)
  insert into public.wc_user_scores (user_id, wcc, updated_at)
  select u.user_id, public.wc_compute_user_wcc(u.user_id), now()
    from (
      select distinct user_id from public.wc_memberships
       where targets is null or user_id = any(targets)
    ) u
  on conflict (user_id) do update set wcc = excluded.wcc, updated_at = now();

  -- 2. global leader anchor
  select coalesce(max(wcc), 0) into leader from public.wc_user_scores;

  -- 3. recompute discrete-tier multipliers for the targeted rows
  update public.wc_user_scores s
     set beer_mult = case
           when not enabled or leader <= 0 then 1.0
           else greatest(1, least(10, round(1 + 9 * greatest(0, least(1, 1 - s.wcc::numeric / leader))))) end,
         passport_mult = case
           when not enabled or leader <= 0 then 1.0
           else 1 + round(8 * greatest(0, least(1, 1 - s.wcc::numeric / leader))) / 2 end,
         stake_mult = case
           when not enabled or leader <= 0 then 1.0
           else 1 + round(10 * greatest(0, least(1, 1 - s.wcc::numeric / leader))) / 10 end,
         updated_at = now()
   where targets is null or s.user_id = any(targets);
end;
$$;
