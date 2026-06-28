-- ============================================================
-- World Cup Cup - multiplier curve: linear -> logarithmic deficit
--
-- The linear deficit (1 - score/leader) gave too much to high scorers (someone
-- at half the leader's score got ~6x beers / 1.5x stakes). A log deficit
-- compresses the high end toward 1x and concentrates the boost at the bottom:
--   ratio = 1 - ln(score+1)/ln(leader+1)
-- e.g. leader 4181: score 2000 -> 1.1x stake / 2x beer (was 1.5x / 6x); only the
-- deep tail (<~50) reaches the big multipliers. Tier mapping is unchanged.
--
-- Curve change is SQL-only - the app reads stored multipliers, so no redeploy.
-- Idempotent: create or replace + a final refresh.
-- ============================================================

-- shared deficit helper - the ONE place the curve shape lives now
create or replace function public.wc_deficit_ratio(score numeric, leader numeric)
returns numeric
language sql
immutable
as $$
  select case
    when leader <= 0 then 0
    else greatest(0, least(1, 1 - ln(greatest(score, 0) + 1) / ln(leader + 1)))
  end;
$$;

-- refresh now derives the ratio from wc_deficit_ratio
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

  insert into public.wc_user_scores (user_id, wcc, updated_at)
  select u.user_id, public.wc_compute_user_wcc(u.user_id), now()
    from (
      select distinct user_id from public.wc_memberships
       where targets is null or user_id = any(targets)
    ) u
  on conflict (user_id) do update set wcc = excluded.wcc, updated_at = now();

  select coalesce(max(wcc), 0) into leader from public.wc_user_scores;

  update public.wc_user_scores s
     set beer_mult = case
           when not enabled or leader <= 0 then 1.0
           else greatest(1, least(10, round(1 + 9 * public.wc_deficit_ratio(s.wcc, leader)))) end,
         passport_mult = case
           when not enabled or leader <= 0 then 1.0
           else 1 + round(8 * public.wc_deficit_ratio(s.wcc, leader)) / 2 end,
         stake_mult = case
           when not enabled or leader <= 0 then 1.0
           else 1 + round(10 * public.wc_deficit_ratio(s.wcc, leader)) / 10 end,
         updated_at = now()
   where targets is null or s.user_id = any(targets);
end;
$$;

-- log_pour: same body, ratio now via wc_deficit_ratio
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
  bm numeric := 1;
  pm numeric := 1;
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

  select (value = 'true') into enabled from public.wc_settings where key = 'multiplier_enabled';
  enabled := coalesce(enabled, false);
  uscore := public.wc_compute_user_wcc(auth.uid());
  select coalesce(max(wcc), 0) into leader from public.wc_user_scores;
  leader := greatest(leader, uscore);
  if enabled and leader > 0 then
    ratio := public.wc_deficit_ratio(uscore, leader);
    bm := greatest(1, least(10, round(1 + 9 * ratio)));
    pm := 1 + round(8 * ratio) / 2;
  end if;

  insert into public.wc_drinks (group_id, user_id, match_id, drink_type, country_code, beer_label)
  values (gid, auth.uid(), target_match_id, 'beer', target_country, target_beer)
  returning id into did;

  if target_country is not null then
    beer_extra := (2 * bm - 2)::int;
    if beer_extra > 0 then
      insert into public.wc_comeback_bonus
        (user_id, group_id, kind, base_wcc, mult, bonus_wcc, drink_id, country_code, match_id)
      values (auth.uid(), gid, 'country_beer', 2, bm, beer_extra, did, target_country, target_match_id);
    end if;
  end if;

  if target_beer is not null then
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

  perform public.wc_refresh_user_scores(array[auth.uid()]);
  return did;
end;
$$;

-- re-anchor everyone on the new curve
select public.wc_refresh_user_scores(null);
