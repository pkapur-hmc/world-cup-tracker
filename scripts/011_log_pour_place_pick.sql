-- ============================================================
-- World Cup Cup - comeback multiplier (#6): secure pour/undo + place_pick budget
--
-- Pours now go through log_pour (SECURITY DEFINER) so the comeback bonus is
-- computed and written server-side (clients can never forge an award). undo_pour
-- removes a drink and any bonuses it created, guarded against negative balance.
-- place_pick snapshots the stake multiplier and counts the new sources in budget.
--
-- Idempotent: create or replace.
-- ============================================================

-- ============================================================
-- log_pour: insert a drink + its comeback bonus (extras only), all snapped to
-- the user's current multiplier (computed from their score vs the global leader).
-- Returns the new drink id. Mirrors pourAction's old direct insert.
-- ============================================================
create or replace function public.log_pour(
  target_match_id int default null,
  target_country  text default null,
  target_beer     text default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  gid uuid;
  did uuid;
  enabled boolean;
  uscore numeric;
  leader numeric;
  ratio numeric;
  bm numeric := 1;     -- beer multiplier (integer-valued)
  pm numeric := 1;     -- passport multiplier (0.5 steps)
  beer_extra int;
  passport_award int;
  passport_extra int;
  is_complete boolean;
  cur_countries int;
  milestone int;
  existing_breadth int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select group_id into gid from public.wc_memberships where user_id = auth.uid() limit 1;
  if gid is null then raise exception 'no group'; end if;

  -- current multiplier (re-read at write time; based on score BEFORE this pour)
  select (value = 'true') into enabled from public.wc_settings where key = 'multiplier_enabled';
  enabled := coalesce(enabled, false);
  uscore := public.wc_compute_user_wcc(auth.uid());
  select coalesce(max(wcc), 0) into leader from public.wc_user_scores;
  leader := greatest(leader, uscore);           -- in case this user is the (stale) leader
  if enabled and leader > 0 then
    ratio := greatest(0, least(1, 1 - uscore / leader));
    bm := greatest(1, least(10, round(1 + 9 * ratio)));
    pm := 1 + round(8 * ratio) / 2;
  end if;

  -- insert the drink (same shape as the old direct insert)
  insert into public.wc_drinks (group_id, user_id, match_id, drink_type, country_code, beer_label)
  values (gid, auth.uid(), target_match_id, 'beer', target_country, target_beer)
  returning id into did;

  -- country beer: write the EXTRA (awarded - flat 2), if any
  if target_country is not null then
    beer_extra := (2 * bm - 2)::int;
    if beer_extra > 0 then
      insert into public.wc_comeback_bonus
        (user_id, group_id, kind, base_wcc, mult, bonus_wcc, drink_id, country_code, match_id)
      values (auth.uid(), gid, 'country_beer', 2, bm, beer_extra, did, target_country, target_match_id);
    end if;
  end if;

  -- passport bonuses only involve stamped (beer_label) drinks
  if target_beer is not null then
    -- DEPTH: did this pour just complete the country's list?
    select exists (
      select 1
        from public.wc_drinks d
        join public.wc_passport_requirements r on r.country_code = d.country_code
       where d.user_id = auth.uid() and d.country_code = target_country and d.beer_label is not null
       group by r.beer_count
      having count(distinct d.beer_label) >= r.beer_count
    ) into is_complete;
    if is_complete then
      passport_award := floor(5 * pm + 0.5)::int;
      passport_extra := passport_award - 5;
      if passport_extra > 0 then
        insert into public.wc_comeback_bonus
          (user_id, group_id, kind, base_wcc, mult, bonus_wcc, country_code, match_id)
        values (auth.uid(), gid, 'passport_depth', 5, pm, passport_extra, target_country, target_match_id)
        on conflict (user_id, country_code) where kind = 'passport_depth' do nothing;
      end if;
    end if;

    -- BREADTH: did distinct-country count cross a new /5 milestone?
    select count(distinct country_code) into cur_countries
      from public.wc_drinks
     where user_id = auth.uid() and country_code is not null and beer_label is not null;
    milestone := cur_countries / 5;
    select count(*) into existing_breadth
      from public.wc_comeback_bonus where user_id = auth.uid() and kind = 'passport_breadth';
    if milestone > existing_breadth then
      passport_award := floor(5 * pm + 0.5)::int;
      passport_extra := passport_award - 5;
      if passport_extra > 0 then
        insert into public.wc_comeback_bonus
          (user_id, group_id, kind, base_wcc, mult, bonus_wcc, country_code, match_id)
        values (auth.uid(), gid, 'passport_breadth', 5, pm, passport_extra, milestone::text, target_match_id)
        on conflict (user_id, country_code) where kind = 'passport_breadth' do nothing;
      end if;
    end if;
  end if;

  -- anti-farm: refresh this user's score+mult so the next pour is worth less
  perform public.wc_refresh_user_scores(array[auth.uid()]);
  return did;
end;
$$;

-- ============================================================
-- undo_pour: delete one drink (by id, owner only) + any bonuses it created,
-- re-evaluate passport completeness, and refuse if it would drop WCC below 0.
-- The negative-balance guard is enforced post-delete (exception rolls back).
-- ============================================================
create or replace function public.undo_pour(target_drink_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  d record;
  still_complete boolean;
  cur_countries int;
  new_wcc int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select id, user_id, match_id, country_code, beer_label
    into d from public.wc_drinks where id = target_drink_id;
  if d.id is null then raise exception 'drink not found'; end if;
  if d.user_id <> auth.uid() then raise exception 'not your drink'; end if;

  -- delete the drink (cascades its country_beer comeback bonus via FK)
  delete from public.wc_drinks where id = target_drink_id;

  -- re-evaluate passport bonuses for the affected country
  if d.country_code is not null then
    select exists (
      select 1
        from public.wc_drinks dd
        join public.wc_passport_requirements r on r.country_code = dd.country_code
       where dd.user_id = auth.uid() and dd.country_code = d.country_code and dd.beer_label is not null
       group by r.beer_count
      having count(distinct dd.beer_label) >= r.beer_count
    ) into still_complete;
    if not still_complete then
      delete from public.wc_comeback_bonus
       where user_id = auth.uid() and kind = 'passport_depth' and country_code = d.country_code;
    end if;

    -- breadth: drop any milestone rows beyond the current distinct-country floor
    select count(distinct country_code) into cur_countries
      from public.wc_drinks
     where user_id = auth.uid() and country_code is not null and beer_label is not null;
    delete from public.wc_comeback_bonus
     where user_id = auth.uid() and kind = 'passport_breadth'
       and (country_code)::int > (cur_countries / 5);
  end if;

  -- non-negative guard: a stake may have spent WCC this drink was funding
  new_wcc := public.wc_compute_user_wcc(auth.uid());
  if new_wcc < 0 then
    raise exception 'That drink is backing a pick stake - removing it would drop you below 0 WCC.';
  end if;

  perform public.wc_refresh_user_scores(array[auth.uid()]);
end;
$$;

-- ============================================================
-- place_pick: snapshot the stake multiplier + budget now reads the score helper
-- (which already includes comeback bonuses + adjustments). Equals the old budget
-- while the new tables are empty / the flag is off.
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
  sm numeric;
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

  -- Budget = your score (incl. comeback bonuses + adjustments) minus WCC locked
  -- in OTHER unsettled stakes. This match's own current stake stays re-allocatable.
  available_wcc := public.wc_compute_user_wcc(auth.uid())
    - (select coalesce(sum(stake), 0) from public.wc_picks
         where user_id = auth.uid() and settled_at is null and match_id <> target_match_id);

  if stake_value > available_wcc then
    raise exception 'stake exceeds available WCC (% available)', available_wcc;
  end if;

  -- snapshot the stake multiplier the player is seeing right now (1.0 while flag off)
  sm := coalesce((select stake_mult from public.wc_user_scores where user_id = auth.uid()), 1.0);

  insert into public.wc_picks (group_id, user_id, match_id, pick, stake, stake_mult, picked_at)
  values (target_group_id, auth.uid(), target_match_id, pick_value, stake_value, sm, now())
  on conflict (user_id, match_id)
  do update set
    group_id = excluded.group_id,
    pick = excluded.pick,
    stake = excluded.stake,
    stake_mult = excluded.stake_mult,   -- re-snap on edit (pre-kickoff)
    picked_at = now()
  where wc_picks.settled_at is null;
end;
$$;
