import { createClient } from "@/lib/supabase/server";

export type GroupPick = {
  userId: string;
  displayName: string;
  role: "host" | "member";
  pick: "A" | "D" | "B" | null;
  stake: number;
  settled_at: string | null;
  payout_wcc: number;
  payout_wcp: number;
};

/**
 * Everyone in the group + their pick for this match (or null if not picked).
 * Used by pre-match (with hidden picks) and post-match (with results).
 */
export async function getGroupPicksForMatch(
  groupId: string,
  matchId: number,
): Promise<GroupPick[]> {
  const supabase = await createClient();

  const [{ data: members }, { data: picks }] = await Promise.all([
    supabase
      .from("wc_memberships")
      .select("user_id, display_name, role")
      .eq("group_id", groupId),
    supabase
      .from("wc_picks")
      .select("user_id, pick, stake, settled_at, payout_wcc, payout_wcp")
      .eq("group_id", groupId)
      .eq("match_id", matchId),
  ]);

  const pickByUser = new Map<string, Omit<GroupPick, "userId" | "displayName" | "role">>();
  for (const p of (picks ?? []) as {
    user_id: string;
    pick: "A" | "D" | "B";
    stake: number;
    settled_at: string | null;
    payout_wcc: number;
    payout_wcp: number;
  }[]) {
    pickByUser.set(p.user_id, {
      pick: p.pick,
      stake: p.stake,
      settled_at: p.settled_at,
      payout_wcc: p.payout_wcc,
      payout_wcp: p.payout_wcp,
    });
  }

  return ((members ?? []) as { user_id: string; display_name: string; role: "host" | "member" }[]).map((m) => {
    const existing = pickByUser.get(m.user_id);
    return {
      userId: m.user_id,
      displayName: m.display_name,
      role: m.role,
      pick: existing?.pick ?? null,
      stake: existing?.stake ?? 0,
      settled_at: existing?.settled_at ?? null,
      payout_wcc: existing?.payout_wcc ?? 0,
      payout_wcp: existing?.payout_wcp ?? 0,
    };
  });
}

/** Drinks count per user for a single match (for the watching-now panel + match drinks bars). */
export async function getDrinksForMatch(
  groupId: string,
  matchId: number,
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wc_drinks")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("match_id", matchId);
  const counts = new Map<string, number>();
  for (const d of (data ?? []) as { user_id: string }[]) {
    counts.set(d.user_id, (counts.get(d.user_id) ?? 0) + 1);
  }
  return counts;
}

/** Currently-watching user_ids (presence pings in the last 5 min). */
export async function getWatchingNow(
  groupId: string,
  matchId: number,
): Promise<Set<string>> {
  const supabase = await createClient();
  const sinceIso = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data } = await supabase
    .from("wc_events")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("match_id", matchId)
    .eq("kind", "watching")
    .gte("created_at", sinceIso);
  return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
}

/** Country-beer drinks a user has done lifetime (for the stamp picker). */
export async function getUserStampedBeers(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wc_drinks")
    .select("beer_label")
    .eq("user_id", userId)
    .not("beer_label", "is", null);
  const s = new Set<string>();
  for (const d of (data ?? []) as { beer_label: string | null }[]) {
    if (d.beer_label) s.add(d.beer_label);
  }
  return s;
}
