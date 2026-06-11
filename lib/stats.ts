/**
 * Server-side fetchers that turn raw rows into per-member stats.
 * Wraps lib/scoring with the actual Supabase queries.
 *
 * Picks queries are guarded so this works before scripts/002 has been applied
 * (wc_picks may not yet exist). Pre-migration => no pick winnings or stakes.
 */
import { createClient } from "@/lib/supabase/server";
import {
  computeMemberStats,
  type DrinkRow,
  type MemberStats,
  type PickRow,
} from "@/lib/scoring";

/** Picks are tracked per-user (not per-bracket). A pick made from any
 *  bracket counts toward the user's totals in every bracket they're in. */
async function fetchPicks(
  _groupId: string,
  userId: string,
): Promise<PickRow[]> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("wc_picks")
      .select("match_id,pick,stake,settled_at,payout_wcc,payout_wcp")
      .eq("user_id", userId);
    if (error) {
      if (/wc_picks/i.test(error.message)) return [];
      throw error;
    }
    return (data ?? []) as PickRow[];
  } catch {
    return [];
  }
}

/** Drinks are tracked per-user, not per-bracket. A pour in any bracket counts
 *  toward the user's totals everywhere they appear. groupId is ignored. */
async function fetchDrinks(
  _groupId: string,
  userId: string,
): Promise<DrinkRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wc_drinks")
    .select("match_id,country_code,beer_label")
    .eq("user_id", userId);
  if (error) {
    if (/country_code|beer_label/i.test(error.message)) {
      const { data: data2, error: err2 } = await supabase
        .from("wc_drinks")
        .select("match_id")
        .eq("user_id", userId);
      if (err2) throw err2;
      return (data2 ?? []).map((d) => ({
        match_id: d.match_id as number | null,
        country_code: null,
        beer_label: null,
      }));
    }
    throw error;
  }
  return (data ?? []) as DrinkRow[];
}

export async function getMemberStats(
  groupId: string,
  userId: string,
): Promise<MemberStats> {
  const [drinks, picks] = await Promise.all([
    fetchDrinks(groupId, userId),
    fetchPicks(groupId, userId),
  ]);
  return computeMemberStats(drinks, picks);
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

  const scored: { userId: string; name: string; total: number }[] = [];
  for (const m of members) {
    const [drinks, picks] = await Promise.all([
      fetchDrinks(groupId, m.user_id),
      fetchPicks(groupId, m.user_id),
    ]);
    const s = computeMemberStats(drinks, picks);
    scored.push({ userId: m.user_id, name: m.display_name, total: s.wcc });
  }
  scored.sort((a, b) => b.total - a.total);
  const idx = scored.findIndex((s) => s.userId === userId);
  const rank = idx + 1;
  const aheadName = idx > 0 ? scored[idx - 1].name : undefined;
  return { rank, total: scored.length, aheadName };
}
