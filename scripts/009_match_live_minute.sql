-- =====================================================================
-- World Cup Cup - live match minute
-- ---------------------------------------------------------------------
-- Additive, non-breaking: a nullable column for the in-play clock label
-- ("64'", "HT") captured from the ESPN overlay at sync time. The cron also
-- starts stamping wc_matches.updated_at on every upsert (it already exists,
-- default now(), with no trigger), so it becomes a true "last synced at"
-- the UI can show as "synced Nm ago". Nothing reads either column until the
-- app code that ships with this migration.
-- =====================================================================

alter table public.wc_matches
  add column if not exists live_minute text;
