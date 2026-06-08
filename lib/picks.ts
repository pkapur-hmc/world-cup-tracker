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
 * Picks for a set of users + a match. Returns one row per input member with
 * their (single, user-level) pick or null. Used by the match-page group-picks
 * panel - the input list is the union of everyone across your brackets.
 */
export async function getPicksForUsersInMatch(
  members: { userId: string; displayName: string; role: "host" | "member" }[],
  matchId: number,
): Promise<GroupPick[]> {
  const supabase = await createClient();
  const memberIds = members.map((m) => m.userId);

  const { data: picks } = memberIds.length
    ? await supabase
        .from("wc_picks")
        .select("user_id, pick, stake, settled_at, payout_wcc, payout_wcp")
        .in("user_id", memberIds)
        .eq("match_id", matchId)
    : { data: [] as unknown[] };

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

  return members.map((m) => {
    const existing = pickByUser.get(m.userId);
    return {
      userId: m.userId,
      displayName: m.displayName,
      role: m.role,
      pick: existing?.pick ?? null,
      stake: existing?.stake ?? 0,
      settled_at: existing?.settled_at ?? null,
      payout_wcc: existing?.payout_wcc ?? 0,
      payout_wcp: existing?.payout_wcp ?? 0,
    };
  });
}

/** Drinks count per user for a single match. Filters by the supplied user
 *  set rather than by group_id - drinks are user-wide, so the "who counts"
 *  decision belongs to the caller. */
export async function getDrinksForUsersInMatch(
  userIds: string[],
  matchId: number,
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("wc_drinks")
    .select("user_id")
    .in("user_id", userIds)
    .eq("match_id", matchId);
  const counts = new Map<string, number>();
  for (const d of (data ?? []) as { user_id: string }[]) {
    counts.set(d.user_id, (counts.get(d.user_id) ?? 0) + 1);
  }
  return counts;
}

/** Currently-watching user_ids (presence pings in the last 5 min), restricted
 *  to the supplied user set. */
export async function getWatchingForUsersInMatch(
  userIds: string[],
  matchId: number,
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const supabase = await createClient();
  const sinceIso = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data } = await supabase
    .from("wc_events")
    .select("user_id")
    .in("user_id", userIds)
    .eq("match_id", matchId)
    .eq("kind", "watching")
    .gte("created_at", sinceIso);
  return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
}

/** Per-beer pour counts for one user in one match. Key: beer_label, value: count.
 *  Optionally restrict to a set of country codes (typically the match's two
 *  teams) so the rendered rails and the basic/country breakdown agree. */
export async function getUserBeerCountsForMatch(
  userId: string,
  matchId: number,
  countryCodes?: string[],
): Promise<Map<string, number>> {
  const supabase = await createClient();
  let q = supabase
    .from("wc_drinks")
    .select("beer_label,country_code")
    .eq("user_id", userId)
    .eq("match_id", matchId)
    .not("beer_label", "is", null);
  if (countryCodes && countryCodes.length > 0) {
    q = q.in("country_code", countryCodes);
  }
  const { data } = await q;
  const counts = new Map<string, number>();
  for (const d of (data ?? []) as { beer_label: string | null }[]) {
    if (!d.beer_label) continue;
    counts.set(d.beer_label, (counts.get(d.beer_label) ?? 0) + 1);
  }
  return counts;
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
