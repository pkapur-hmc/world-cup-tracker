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

/** Comeback-multiplier bonuses + soft-reset adjustments for one user. Returns 0
 *  if those tables don't exist yet (pre scripts/010) - the score is then just
 *  the derived base, exactly as before. */
async function fetchExtraWcc(userId: string): Promise<number> {
  const supabase = await createClient();
  const [cbRes, adjRes] = await Promise.all([
    supabase.from("wc_comeback_bonus").select("bonus_wcc").eq("user_id", userId),
    supabase.from("wc_score_adjustments").select("delta").eq("user_id", userId),
  ]);
  const c = !cbRes.error
    ? (cbRes.data ?? []).reduce((s, r) => s + Number((r as { bonus_wcc: number }).bonus_wcc), 0)
    : 0;
  const a = !adjRes.error
    ? (adjRes.data ?? []).reduce((s, r) => s + Number((r as { delta: number }).delta), 0)
    : 0;
  return c + a;
}

/** Batched version of fetchExtraWcc for a member set (leaderboard / rank). */
async function fetchExtraWccForUsers(userIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  const supabase = await createClient();
  const [cbRes, adjRes] = await Promise.all([
    supabase.from("wc_comeback_bonus").select("user_id, bonus_wcc").in("user_id", userIds),
    supabase.from("wc_score_adjustments").select("user_id, delta").in("user_id", userIds),
  ]);
  if (!cbRes.error)
    for (const r of (cbRes.data ?? []) as { user_id: string; bonus_wcc: number }[])
      out.set(r.user_id, (out.get(r.user_id) ?? 0) + Number(r.bonus_wcc));
  if (!adjRes.error)
    for (const r of (adjRes.data ?? []) as { user_id: string; delta: number }[])
      out.set(r.user_id, (out.get(r.user_id) ?? 0) + Number(r.delta));
  return out;
}

export async function getMemberStats(
  groupId: string,
  userId: string,
): Promise<MemberStats> {
  const [drinks, picks, extra] = await Promise.all([
    fetchDrinks(groupId, userId),
    fetchPicks(groupId, userId),
    fetchExtraWcc(userId),
  ]);
  return computeMemberStats(drinks, picks, extra);
}

export type UserMultipliers = {
  beerMult: number;
  passportMult: number;
  stakeMult: number;
  wcc: number;
  leaderWcc: number;
};

/** The viewer's current comeback multipliers + score, read from the snapshot
 *  (wc_user_scores). Defaults to 1x / 0 if the feature isn't live or the user
 *  has no snapshot row yet. */
export async function getUserMultipliers(userId: string): Promise<UserMultipliers> {
  const def: UserMultipliers = { beerMult: 1, passportMult: 1, stakeMult: 1, wcc: 0, leaderWcc: 0 };
  const supabase = await createClient();
  const meRes = await supabase
    .from("wc_user_scores")
    .select("wcc, beer_mult, passport_mult, stake_mult")
    .eq("user_id", userId)
    .maybeSingle();
  if (meRes.error || !meRes.data) return def;
  const leadRes = await supabase
    .from("wc_user_scores")
    .select("wcc")
    .order("wcc", { ascending: false })
    .limit(1)
    .maybeSingle();
  const d = meRes.data as {
    wcc: number;
    beer_mult: number;
    passport_mult: number;
    stake_mult: number;
  };
  return {
    beerMult: Number(d.beer_mult),
    passportMult: Number(d.passport_mult),
    stakeMult: Number(d.stake_mult),
    wcc: Number(d.wcc),
    leaderWcc: !leadRes.error && leadRes.data ? Number((leadRes.data as { wcc: number }).wcc) : 0,
  };
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

  const extras = await fetchExtraWccForUsers(members.map((m) => m.user_id));
  const scored: { userId: string; name: string; total: number }[] = [];
  for (const m of members) {
    const [drinks, picks] = await Promise.all([
      fetchDrinks(groupId, m.user_id),
      fetchPicks(groupId, m.user_id),
    ]);
    const s = computeMemberStats(drinks, picks, extras.get(m.user_id) ?? 0);
    scored.push({ userId: m.user_id, name: m.display_name, total: s.wcc });
  }
  scored.sort((a, b) => b.total - a.total);
  const idx = scored.findIndex((s) => s.userId === userId);
  const rank = idx + 1;
  const aheadName = idx > 0 ? scored[idx - 1].name : undefined;
  return { rank, total: scored.length, aheadName };
}
