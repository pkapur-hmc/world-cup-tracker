/**
 * Server-side fetchers that turn raw rows into per-member stats.
 * Wraps lib/scoring with the actual Supabase queries.
 *
 * Picks queries are guarded so this works before scripts/002 has been applied
 * (wc_picks may not yet exist). Pre-migration => zero WCP, no stake spending.
 */
import { createClient } from "@/lib/supabase/server";
import {
  computeMemberStats,
  type DrinkRow,
  type MatchLite,
  type MemberStats,
  type PickRow,
} from "@/lib/scoring";

async function fetchPicks(
  groupId: string,
  userId: string,
): Promise<PickRow[]> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("wc_picks")
      .select("match_id,pick,stake,settled_at,payout_wcc,payout_wcp")
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (error) {
      // Table may not exist pre-migration; treat as no picks.
      if (/wc_picks/i.test(error.message)) return [];
      throw error;
    }
    return (data ?? []) as PickRow[];
  } catch {
    return [];
  }
}

async function fetchDrinks(
  groupId: string,
  userId: string,
): Promise<DrinkRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wc_drinks")
    .select("match_id,country_code")
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) {
    if (/country_code/i.test(error.message)) {
      // country_code column not yet added; refetch without it.
      const { data: data2, error: err2 } = await supabase
        .from("wc_drinks")
        .select("match_id")
        .eq("group_id", groupId)
        .eq("user_id", userId);
      if (err2) throw err2;
      return (data2 ?? []).map((d) => ({
        match_id: d.match_id as number | null,
        country_code: null,
      }));
    }
    throw error;
  }
  return (data ?? []) as DrinkRow[];
}

async function fetchMatchesLite(): Promise<Map<number, MatchLite>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wc_matches")
    .select("id,team_a_code,team_b_code");
  if (error) throw error;
  const m = new Map<number, MatchLite>();
  for (const row of (data ?? []) as MatchLite[]) m.set(row.id, row);
  return m;
}

export async function getMemberStats(
  groupId: string,
  userId: string,
): Promise<MemberStats> {
  const [drinks, picks, matchesById] = await Promise.all([
    fetchDrinks(groupId, userId),
    fetchPicks(groupId, userId),
    fetchMatchesLite(),
  ]);
  return computeMemberStats(drinks, picks, matchesById);
}

/** Rank a member among their group by total. Returns 1-indexed rank + total members. */
export async function getRankInGroup(
  groupId: string,
  userId: string,
): Promise<{ rank: number; total: number; aheadName?: string }> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("wc_memberships")
    .select("user_id, display_name")
    .eq("group_id", groupId);
  if (!members) return { rank: 1, total: 1 };

  const matchesById = await fetchMatchesLite();
  const scored: { userId: string; name: string; total: number }[] = [];
  for (const m of members) {
    const [drinks, picks] = await Promise.all([
      fetchDrinks(groupId, m.user_id),
      fetchPicks(groupId, m.user_id),
    ]);
    const s = computeMemberStats(drinks, picks, matchesById);
    scored.push({ userId: m.user_id, name: m.display_name, total: s.total });
  }
  scored.sort((a, b) => b.total - a.total);
  const idx = scored.findIndex((s) => s.userId === userId);
  const rank = idx + 1;
  const aheadName = idx > 0 ? scored[idx - 1].name : undefined;
  return { rank, total: scored.length, aheadName };
}
