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
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
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

export function toMatchRow(m: FdMatch): MatchRow {
  const winnerCode =
    m.score.winner === "HOME_TEAM"
      ? (m.homeTeam.tla ?? null)
      : m.score.winner === "AWAY_TEAM"
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
