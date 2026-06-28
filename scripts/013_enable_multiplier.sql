-- ============================================================
-- World Cup Cup - comeback multiplier (#6): THE FLIP
--
-- Run this ONLY when ready to turn the multiplier on. Everything in 010-012 is
-- a no-op until this runs: bonus rows are 0 and stake_mult is 1.0 while the flag
-- is false. After this, multipliers apply to NEW earnings only; past totals are
-- unchanged (no backfill - nothing was multiplied retroactively).
--
-- Reversible: set the value back to 'false' and refresh. Future earnings revert
-- to flat; already-earned comeback bonuses are kept (correct - don't void what
-- people legitimately earned).
-- ============================================================
update public.wc_settings set value = 'true' where key = 'multiplier_enabled';

-- recompute everyone's live multiplier against the current leader
select public.wc_refresh_user_scores(null);
