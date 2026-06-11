/**
 * Pure, client-safe match-phase logic - no server imports, so client components
 * (schedule list, pick guard) can use it alongside server code. lib/fixtures
 * re-exports these for server callers.
 *
 * A match is "live" from kickoff until the feed marks it final OR LIVE_WINDOW_MS
 * elapses, whichever comes first. We drive this off the CLOCK, not the feed's
 * status flag: football-data's free tier lags badly (routinely reports a match
 * TIMED/IN_PLAY minutes after the real state changes, and can be late to
 * FINISHED too), so waiting on its flag would leave the live loop dark during
 * the actual match. The cap is a backstop so a feed that never flips to FINISHED
 * can't pin a game "live" forever; 3.5h comfortably covers a knockout that runs
 * to extra time + penalties.
 */
export const LIVE_WINDOW_MS = 3.5 * 60 * 60 * 1000;

export type MatchPhase = "pre" | "live" | "post";

export function matchPhase(m: { status: string; kickoff_at: string }): MatchPhase {
  if (m.status === "final") return "post";
  if (m.status === "postponed") return "pre";
  const kickoff = new Date(m.kickoff_at).getTime();
  const now = Date.now();
  if (now < kickoff) return "pre";
  if (now < kickoff + LIVE_WINDOW_MS) return "live";
  return "post";
}
