/**
 * Football-data.org v4 client + mappers.
 * Free tier: 10 requests/min. Auth via X-Auth-Token header.
 * Docs: https://www.football-data.org/documentation/api
 */

import { FLAG_EMOJI } from "@/data/flag-emojis";

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION = "WC"; // FIFA World Cup

export type FdStage =
  | "GROUP_STAGE"
  | "LAST_32"
  | "LAST_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "THIRD_PLACE"
  | "FINAL";

export type FdStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED"
  | "AWARDED";

export type FdTeam = {
  id: number;
  name: string;
  shortName: string | null;
  tla: string | null; // 3-letter code
  crest: string | null;
};

export type FdMatch = {
  id: number;
  utcDate: string;
  status: FdStatus;
  stage: FdStage;
  group: string | null; // "GROUP_A" .. "GROUP_L"
  homeTeam: FdTeam;
  awayTeam: FdTeam;
  score: {
    // `winner` is null on penalty shootouts (duration PENALTY_SHOOTOUT) - the
    // shootout result is folded into `fullTime` instead, so we derive the
    // winner from fullTime rather than trusting this field. See toMatchRow.
    //
    // FINALIZATION IS NOT ATOMIC (verified against live v4 payloads, QF 537385
    // ENG/NOR + 537386 ARG/SUI, 2026-07-11). On a knockout that runs past 90',
    // the fields land in stages and the free tier serves stale replicas, so a
    // consumer can observe intermediate states in any order:
    //   1. `status` flips to FINISHED first, sometimes with `fullTime` still
    //      holding only the REGULATION score (a LEVEL 1-1) and `winner` null.
    //   2. `regularTime`/`extraTime`/`penalties` and the corrected (cumulative)
    //      `fullTime` land later - up to ~6h later on the bulk feed.
    //   3. `winner` lands last.
    // `fullTime` is the cumulative final total once COMPLETE: regular + extra
    // time, with shootout goals folded in too. But it is transiently WRONG
    // (regulation-only, level) on a FINISHED knockout mid-finalization - so a
    // FINISHED knockout at a level `fullTime` is ALWAYS an incomplete-
    // finalization artifact, never a real result (knockouts cannot end level).
    // hasCompleteKnockoutResult() encodes that invariant. The single-match
    // detail endpoint (fetchMatch) finalizes sooner than the bulk feed.
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration?: string;
    fullTime: { home: number | null; away: number | null };
    // Present only once the breakdown lands (stage 2 above); unused by the
    // mappers, which derive from the cumulative `fullTime`, but documented here
    // as the signal that finalization is complete.
    regularTime?: { home: number | null; away: number | null };
    extraTime?: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
  lastUpdated: string;
};

export type FdMatchesResponse = {
  matches: FdMatch[];
};

// ---- DB row shapes (mirror scripts/001_schema.sql) ----

export type TeamRow = {
  code: string;
  name: string;
  flag_emoji: string | null;
  group_letter: string | null;
};

// Note: venue is intentionally omitted - it's static once seeded
// (see scripts/import-venues.ts) and football-data doesn't expose it anyway.
// Upserting a row without `venue` leaves any existing value untouched.
export type MatchRow = {
  id: number;
  stage: "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";
  group_letter: string | null;
  team_a_code: string | null;
  team_b_code: string | null;
  kickoff_at: string;
  status: "scheduled" | "live" | "final" | "postponed";
  score_a: number | null;
  score_b: number | null;
  winner_code: string | null;
};

// ---- Mappers ----

const STAGE_MAP: Record<FdStage, MatchRow["stage"]> = {
  GROUP_STAGE: "group",
  LAST_32: "r32",
  LAST_16: "r16",
  QUARTER_FINALS: "qf",
  SEMI_FINALS: "sf",
  THIRD_PLACE: "third_place",
  FINAL: "final",
};

const STATUS_MAP: Record<FdStatus, MatchRow["status"]> = {
  SCHEDULED: "scheduled",
  TIMED: "scheduled",
  IN_PLAY: "live",
  PAUSED: "live",
  FINISHED: "final",
  AWARDED: "final",
  POSTPONED: "postponed",
  SUSPENDED: "postponed",
  CANCELLED: "postponed",
};

export function groupLetterFrom(group: string | null): string | null {
  if (!group) return null;
  const m = group.match(/^GROUP_([A-L])$/);
  return m ? m[1] : null;
}

/** True for every stage except the group phase (knockouts cannot end level). */
export function isKnockoutStage(stage: FdStage): boolean {
  return stage !== "GROUP_STAGE";
}

/**
 * The finalization invariant (see the FdMatch.score comment for the full
 * lifecycle). A result is COMPLETE when football-data reports it FINISHED/
 * AWARDED with a non-null fullTime AND, for a knockout, a DECISIVE fullTime.
 * A FINISHED knockout at a null or LEVEL fullTime is a stage-1 finalization
 * artifact, not a real result. Group draws are legitimate, so a level fullTime
 * there is still complete.
 */
export function hasCompleteKnockoutResult(m: FdMatch): boolean {
  if (m.status !== "FINISHED" && m.status !== "AWARDED") return false;
  const { home, away } = m.score.fullTime;
  if (home === null || away === null) return false;
  if (!isKnockoutStage(m.stage)) return true; // group draws are complete
  return home !== away; // a knockout result must be decisive
}

/** Minimal shape of a stored wc_matches row that the merge guards need. */
export type ExistingMatchState = {
  score_a: number | null;
  score_b: number | null;
  winner_code: string | null;
};

/**
 * Fix A - stale-level clobber guard. A stored DECISIVE knockout winner is
 * terminal: nothing football-data serves afterwards should overwrite it with a
 * level or null score, because a knockout cannot end level, so such an incoming
 * score can only be finalization-stage-1 garbage. Returns true when the stored
 * row must be kept.
 *
 * An incoming DECISIVE result (hasCompleteKnockoutResult -> true) is NOT kept;
 * it flows through even when it differs from the stored winner - that is the
 * legitimate winner-correction path the 018 self-healing settlement relies on
 * (SUI/COL 537382).
 */
export function shouldKeepExistingKnockoutResult(
  m: FdMatch,
  ex: ExistingMatchState,
): boolean {
  const exDecisiveWinner =
    isKnockoutStage(m.stage) &&
    ex.score_a !== null &&
    ex.score_b !== null &&
    ex.score_a !== ex.score_b &&
    ex.winner_code !== null;
  return exDecisiveWinner && !hasCompleteKnockoutResult(m);
}

/**
 * Fix B - detail-endpoint rescue for limbo knockouts. A knockout that
 * football-data reports FINISHED/AWARDED but WITHOUT a decisive fullTime (null
 * or level) is stuck mid-finalization. While the stored row still has no winner
 * we fetch the single-match detail endpoint (which finalizes sooner and carries
 * the extraTime/penalties breakdown) to turn a multi-hour limbo into minutes.
 * Once a decisive winner is stored we stop spending calls.
 */
export function needsLimboDetailFetch(
  m: FdMatch,
  dbWinnerCode: string | null | undefined,
): boolean {
  if (m.status !== "FINISHED" && m.status !== "AWARDED") return false;
  if (!isKnockoutStage(m.stage)) return false;
  if (hasCompleteKnockoutResult(m)) return false;
  return dbWinnerCode === null || dbWinnerCode === undefined;
}

export function toMatchRow(m: FdMatch): MatchRow {
  // Winner is derived from the fullTime score, NOT score.winner. football-data
  // leaves score.winner null for penalty shootouts (observed AUS/EGY r32:
  // winner null, duration PENALTY_SHOOTOUT, fullTime 3-5) but folds the
  // shootout tally into fullTime, so the higher fullTime score is the true
  // winner. A level fullTime is a draw (winner null). This is also robust to
  // the transient null winner football-data returns mid-finalization.
  //
  // CAVEAT: `fullTime` itself is transiently WRONG (regulation-only, level) on
  // a FINISHED knockout during stage-1 finalization, so this mapper will emit a
  // null winner + level score for such a row. That is a real, expected
  // intermediate state - the sync's clobber guard (Fix A) and detail rescue
  // (Fix B) keep it from corrupting a row that already knows the true result.
  // See hasCompleteKnockoutResult and the FdMatch.score lifecycle comment.
  const { home, away } = m.score.fullTime;
  const winnerCode =
    home === null || away === null
      ? null
      : home > away
        ? (m.homeTeam.tla ?? null)
        : away > home
          ? (m.awayTeam.tla ?? null)
          : null;

  return {
    id: m.id,
    stage: STAGE_MAP[m.stage],
    group_letter: groupLetterFrom(m.group),
    team_a_code: m.homeTeam.tla ?? null,
    team_b_code: m.awayTeam.tla ?? null,
    kickoff_at: m.utcDate,
    status: STATUS_MAP[m.status],
    score_a: m.score.fullTime.home,
    score_b: m.score.fullTime.away,
    winner_code: winnerCode,
  };
}

/** Collect unique teams that have a tla. */
export function teamsFromMatches(matches: FdMatch[]): TeamRow[] {
  const byCode = new Map<string, TeamRow>();
  for (const m of matches) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      if (!t.tla) continue;
      const groupLetter =
        m.stage === "GROUP_STAGE" ? groupLetterFrom(m.group) : null;
      const existing = byCode.get(t.tla);
      if (!existing) {
        byCode.set(t.tla, {
          code: t.tla,
          name: t.name,
          flag_emoji: FLAG_EMOJI[t.tla] ?? null,
          group_letter: groupLetter,
        });
      } else if (!existing.group_letter && groupLetter) {
        existing.group_letter = groupLetter;
      }
    }
  }
  return Array.from(byCode.values());
}

// ---- Fetcher ----

export async function fetchAllMatches(apiKey: string): Promise<FdMatch[]> {
  const res = await fetch(`${BASE_URL}/competitions/${COMPETITION}/matches`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `football-data ${res.status}: ${res.statusText} - ${await res.text()}`,
    );
  }
  const data = (await res.json()) as FdMatchesResponse;
  return data.matches;
}

/**
 * Single-match endpoint. The bulk competition feed omits score.fullTime
 * (stays null even on FINISHED matches - observed MEX/RSA 2026-06-11), while
 * this endpoint carries the real score. v4 returns the match object directly.
 */
export async function fetchMatch(apiKey: string, id: number): Promise<FdMatch> {
  const res = await fetch(`${BASE_URL}/matches/${id}`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `football-data ${res.status}: ${res.statusText} - ${await res.text()}`,
    );
  }
  return (await res.json()) as FdMatch;
}
