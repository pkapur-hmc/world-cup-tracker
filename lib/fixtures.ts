/**
 * The only place app code reads match data.
 * Everything else (routes, components, leaderboard math) calls through here.
 */
import { createClient } from "@/lib/supabase/server";

export type Match = {
  id: number;
  stage: "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";
  group_letter: string | null;
  team_a_code: string | null;
  team_b_code: string | null;
  kickoff_at: string;
  venue: string | null;
  status: "scheduled" | "live" | "final" | "postponed";
  score_a: number | null;
  score_b: number | null;
  winner_code: string | null;
};

const SELECT =
  "id,stage,group_letter,team_a_code,team_b_code,kickoff_at,venue,status,score_a,score_b,winner_code";

export async function getLiveMatches(): Promise<Match[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wc_matches")
    .select(SELECT)
    .eq("status", "live")
    .order("kickoff_at");
  if (error) throw error;
  return (data ?? []) as Match[];
}

export async function getNextMatch(): Promise<Match | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wc_matches")
    .select(SELECT)
    .in("status", ["scheduled"])
    .gt("kickoff_at", new Date().toISOString())
    .order("kickoff_at")
    .limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as Match | null;
}

export async function getMatchById(id: number): Promise<Match | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wc_matches")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Match | null;
}

/** All matches grouped by UTC day. Useful for the Schedule page. */
export async function getMatchesByDay(
  stage?: Match["stage"],
): Promise<Map<string, Match[]>> {
  const supabase = await createClient();
  let q = supabase.from("wc_matches").select(SELECT).order("kickoff_at");
  if (stage) q = q.eq("stage", stage);
  const { data, error } = await q;
  if (error) throw error;

  const byDay = new Map<string, Match[]>();
  for (const m of (data ?? []) as Match[]) {
    const day = m.kickoff_at.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(m);
    byDay.set(day, arr);
  }
  return byDay;
}

/** Matches a user might still need a pick on (scheduled, kickoff in the future). */
export async function getUpcomingPickableMatches(): Promise<Match[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wc_matches")
    .select(SELECT)
    .eq("status", "scheduled")
    .gt("kickoff_at", new Date().toISOString())
    .order("kickoff_at");
  if (error) throw error;
  return (data ?? []) as Match[];
}

/** Every match a team is in, ordered by kickoff. */
export async function getMatchesForTeam(code: string): Promise<Match[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wc_matches")
    .select(SELECT)
    .or(`team_a_code.eq.${code},team_b_code.eq.${code}`)
    .order("kickoff_at");
  if (error) throw error;
  return (data ?? []) as Match[];
}

/** The next scheduled match for a given team code (any side). */
export async function getNextMatchForTeam(code: string): Promise<Match | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wc_matches")
    .select(SELECT)
    .or(`team_a_code.eq.${code},team_b_code.eq.${code}`)
    .eq("status", "scheduled")
    .gt("kickoff_at", new Date().toISOString())
    .order("kickoff_at")
    .limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as Match | null;
}
