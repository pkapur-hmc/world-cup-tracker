-- ============================================================
-- World Cup Cup - soft reset (#9): knockout compression
--
-- One-time, MANUAL, reversible. Pulls high scores DOWN toward the mean; players
-- at/below the mean are untouched (no windfalls). Writes only NEGATIVE rows into
-- wc_score_adjustments - drinks, picks, and passport counts are never touched.
--
--   new = round(mean + (score - mean) * factor)   for score > mean   (factor 0.4)
--   new = score                                    for score <= mean
--
-- Run via the service role (e.g. a verify/admin script) - NOT callable by a
-- logged-in player. To undo, call revert_knockout_compression(<batch_id>).
--
-- Usage:
--   select * from apply_knockout_compression(0.4);   -- inspect the returned rows
--   select revert_knockout_compression('<batch uuid>');
-- ============================================================
create or replace function public.apply_knockout_compression(factor numeric default 0.4)
returns table(user_id uuid, old_wcc int, new_wcc int, delta int)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  avg_wcc numeric;
  batch uuid := gen_random_uuid();
begin
  -- service-role / admin only (a normal request carries a user id)
  if auth.uid() is not null then raise exception 'admin only'; end if;

  perform public.wc_refresh_user_scores(null);
  select avg(wcc) into avg_wcc from public.wc_user_scores;
  if avg_wcc is null then return; end if;

  return query
  with calc as (
    select s.user_id as uid,
           s.wcc as ow,
           case when s.wcc > avg_wcc
                then round(avg_wcc + (s.wcc - avg_wcc) * factor)::int
                else s.wcc end as nw
      from public.wc_user_scores s
  ), ins as (
    insert into public.wc_score_adjustments (user_id, reason, delta, batch_id)
    select calc.uid, 'knockout_compression', (calc.nw - calc.ow), batch
      from calc where calc.nw <> calc.ow
    returning 1
  )
  select calc.uid, calc.ow, calc.nw, (calc.nw - calc.ow)
    from calc order by calc.ow desc;

  -- re-anchor everyone to the compressed leader
  perform public.wc_refresh_user_scores(null);
end;
$$;

create or replace function public.revert_knockout_compression(target_batch uuid)
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n int;
begin
  if auth.uid() is not null then raise exception 'admin only'; end if;
  delete from public.wc_score_adjustments where batch_id = target_batch;
  get diagnostics n = row_count;
  perform public.wc_refresh_user_scores(null);
  return n;
end;
$$;
