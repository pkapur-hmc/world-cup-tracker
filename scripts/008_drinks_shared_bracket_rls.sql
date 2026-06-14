-- ============================================================
-- World Cup Cup - Fix leaderboard drink counts across brackets
--
-- SAFE TO RUN ON LIVE DATA
--   • Read-only policy change (SELECT on wc_drinks only).
--   • Does NOT insert, update, or delete any drink or pick rows.
--   • Does NOT touch wc_picks or any other table.
--   • All existing logged drinks and picks are unchanged.
--
-- Problem
--   Drinks are user-level: one pour counts everywhere. But each row still
--   carries a denormalized group_id from whichever bracket the user was in
--   when they tapped +1. The old SELECT policy only allowed reading drinks
--   whose group_id you belong to directly. Teammates in a shared bracket
--   could not see those rows on leaderboards (the drinker still saw their
--   own totals because user_id = auth.uid() always passes).
--
-- Fix
--   Mirror the picks policy from 004_user_level_picks.sql: allow SELECT on
--   drinks for any user with whom you share at least one bracket.
-- ============================================================

drop policy if exists "drinks readable by group members" on public.wc_drinks;
drop policy if exists "drinks readable by shared bracket" on public.wc_drinks;
create policy "drinks readable by shared bracket" on public.wc_drinks
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
        from public.wc_memberships m1
        join public.wc_memberships m2 on m1.group_id = m2.group_id
       where m1.user_id = auth.uid()
         and m2.user_id = wc_drinks.user_id
    )
  );
