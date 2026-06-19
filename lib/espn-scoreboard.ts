/**
 * ESPN public scoreboard - unofficial but stable JSON feed, no auth, no key.
 * Used ONLY as a live-score overlay: football-data stays the source of truth
 * for fixtures, status, and settlement. football-data's free tier lags
 * in-play scores by many minutes (KOR/CZE 2026-06-12: ESPN had 0-1 in the
 * 64th minute while both football-data endpoints still said 0-0 with a
 * fresh lastUpdated); ESPN updates near-real-time.
 */

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

/**
 * ESPN abbreviations are FIFA codes for 47 of the 48 teams (verified against
 * wc_teams 2026-06-12); map the stragglers ESPN-code -> our DB code here.
 */
const CODE_ALIASES: Record<string, string> = {
  URU: "URY",
};

export type EspnScore = {
  homeCode: string;
  awayCode: string;
  kickoffMs: number;
  state: "in" | "post";
  homeScore: number;
  awayScore: number;
  /** In-play clock label as ESPN renders it: "64'", "45'+2", "HT". Null when
   *  not live or ESPN omits it. Used to show how far the synced data has got. */
  minute: string | null;
};

type EspnScoreboard = {
  events?: Array<{
    date: string;
    status?: {
      displayClock?: string;
      type?: { state?: string; shortDetail?: string };
    };
    competitions?: Array<{
      competitors?: Array<{
        homeAway?: string;
        score?: string;
        team?: { abbreviation?: string };
      }>;
    }>;
  }>;
};

/** In-play and just-finished matches with a numeric score. Pre-match events are skipped. */
export async function fetchEspnScores(): Promise<EspnScore[]> {
  const res = await fetch(SCOREBOARD_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`espn scoreboard ${res.status}: ${res.statusText}`);
  }
  const data = (await res.json()) as EspnScoreboard;

  const out: EspnScore[] = [];
  for (const e of data.events ?? []) {
    const state = e.status?.type?.state;
    if (state !== "in" && state !== "post") continue;
    const competitors = e.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home?.team?.abbreviation || !away?.team?.abbreviation) continue;
    const homeScore = Number(home.score);
    const awayScore = Number(away.score);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
    const kickoffMs = Date.parse(e.date);
    if (Number.isNaN(kickoffMs)) continue;
    // Only meaningful in-play. shortDetail ("64'", "HT") reads cleaner than the
    // raw displayClock; fall back to the clock if shortDetail is absent.
    const minute =
      state === "in"
        ? (e.status?.type?.shortDetail?.trim() ||
            e.status?.displayClock?.trim() ||
            null)
        : null;
    out.push({
      homeCode: CODE_ALIASES[home.team.abbreviation] ?? home.team.abbreviation,
      awayCode: CODE_ALIASES[away.team.abbreviation] ?? away.team.abbreviation,
      kickoffMs,
      state,
      homeScore,
      awayScore,
      minute,
    });
  }
  return out;
}
