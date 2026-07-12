-- ============================================================
-- World Cup Cup - lock a pick's stake multiplier at KICKOFF (not placement)
--
-- Product rule (supersedes the old "the rate you saw at placement is the rate
-- you get"): a pick's stake_mult is the bettor's comeback rate at the KICKOFF
-- of the match being bet on - the instant bets lock. place_pick's pick-time
-- stamp stays a PROVISIONAL preview (re-snapped on every pre-kickoff edit); this
-- migration adds the one-shot kickoff lock that freezes the real rate.
--
-- Why kickoff and not placement: place_pick snapshots stake_mult from the
-- wc_user_scores snapshot at pick time, and that snapshot only advances when
-- settlements land. A match that settles late (extra-time limbo, see
-- PLAN-extra-time-limbo-fix.md) leaves later picks carrying a rate that ignores
-- the just-finished result. Locking at kickoff makes the rate reflect every
-- match that has actually resolved by the time bets close.
--
-- lock_due_stake_mults() is meant to be called once per cron tick, AFTER
-- settlement + wc_refresh_user_scores, so a match settling this tick is already
-- in the snapshot before the next kickoff locks against it.
--
-- Does NOT touch place_pick (its provisional pick-time stamp is unchanged) or
-- settle_match_picks (payout still reads whatever stake_mult is stored, which is
-- now the kickoff-locked value once this has run).
--
-- Idempotent: add column if not exists; create or replace; the mult_locked_at
-- null gate makes the lock one-shot per pick (a later tick never re-snaps a pick
-- whose rate already locked, so other matches settling mid-game cannot churn it).
-- ============================================================

alter table public.wc_picks
  add column if not exists mult_locked_at timestamptz;

-- ---------- kickoff stake-multiplier lock ----------
-- For every pick whose match has kicked off, is not yet settled, and has not yet
-- locked: freeze stake_mult to the user's CURRENT wc_user_scores.stake_mult and
-- stamp mult_locked_at. Set-based, one statement. The mult_locked_at IS NULL
-- gate makes it one-shot: once a pick locks, no later tick re-snaps it (coalesce
-- guards the rare missing wc_user_scores row - keep the existing stamp rather
-- than null out a NOT NULL column). Returns the number of picks locked this call.
create or replace function public.lock_due_stake_mults()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  locked_count int := 0;
begin
  update public.wc_picks p
     set stake_mult = coalesce(
           (select s.stake_mult from public.wc_user_scores s
             where s.user_id = p.user_id),
           p.stake_mult),
         mult_locked_at = now()
    from public.wc_matches m
   where m.id = p.match_id
     and m.kickoff_at <= now()
     and p.settled_at is null
     and p.mult_locked_at is null;
  get diagnostics locked_count = row_count;
  return locked_count;
end;
$$;
