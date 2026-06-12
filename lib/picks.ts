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

/** Has the user ever made a pick? Used by the home-page onboarding row. */
export async function hasUserEverPicked(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wc_picks")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

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

/** Every pick the current user has made, keyed by match id. Used by the
 *  schedule to show your picked country on each card (mirrors the home page).
 *  Guarded so it returns an empty map before scripts/002 has been applied. */
export type UserMatchPick = {
  pick: "A" | "D" | "B";
  stake: number;
  settled_at: string | null;
  payout_wcc: number;
  payout_wcp: number;
};

export async function getUserPicksByMatch(
  userId: string,
): Promise<Map<number, UserMatchPick>> {
  const out = new Map<number, UserMatchPick>();
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("wc_picks")
      .select("match_id, pick, stake, settled_at, payout_wcc, payout_wcp")
      .eq("user_id", userId);
    if (error) return out;
    for (const r of (data ?? []) as ({ match_id: number } & UserMatchPick)[]) {
      out.set(r.match_id, {
        pick: r.pick,
        stake: r.stake,
        settled_at: r.settled_at,
        payout_wcc: r.payout_wcc,
        payout_wcp: r.payout_wcp,
      });
    }
  } catch {
    return out;
  }
  return out;
}

/** The current user's drink tally per match: raw pours and the WCC those
 *  pours earned (country beer = 2, basic = 1). Powers the schedule's Past
 *  tab per-match result strip. */
export async function getUserDrinkStatsByMatch(
  userId: string,
): Promise<Map<number, { drinks: number; wcc: number }>> {
  const out = new Map<number, { drinks: number; wcc: number }>();
  const supabase = await createClient();
  const { data } = await supabase
    .from("wc_drinks")
    .select("match_id, country_code")
    .eq("user_id", userId);
  for (const d of (data ?? []) as {
    match_id: number | null;
    country_code: string | null;
  }[]) {
    if (d.match_id === null) continue;
    const cur = out.get(d.match_id) ?? { drinks: 0, wcc: 0 };
    cur.drinks += 1;
    cur.wcc += d.country_code ? 2 : 1;
    out.set(d.match_id, cur);
  }
  return out;
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

/** Per-match earnings for a set of users: raw drink count and WCC, where a
 *  country beer is worth 2 WCC and a basic drink 1. Powers the live "your
 *  people" panel, which ranks by WCC (the currency that matters), not raw
 *  drink count. */
export async function getMatchEarningsForUsers(
  userIds: string[],
  matchId: number,
): Promise<Map<string, { drinks: number; wcc: number }>> {
  const out = new Map<string, { drinks: number; wcc: number }>();
  if (userIds.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("wc_drinks")
    .select("user_id, country_code")
    .in("user_id", userIds)
    .eq("match_id", matchId);
  for (const d of (data ?? []) as { user_id: string; country_code: string | null }[]) {
    const cur = out.get(d.user_id) ?? { drinks: 0, wcc: 0 };
    cur.drinks += 1;
    cur.wcc += d.country_code ? 2 : 1;
    out.set(d.user_id, cur);
  }
  return out;
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

/** Country-beer drinks a user has done lifetime, keyed by country (for the
 *  stamp picker + passport progress). Per-country because beer names repeat
 *  across countries (Brahma, Skol, Heineken...) - a Brazil Brahma must not
 *  read as an Argentina stamp. */
export async function getUserStampedBeers(
  userId: string,
): Promise<Map<string, Set<string>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wc_drinks")
    .select("country_code, beer_label")
    .eq("user_id", userId)
    .not("beer_label", "is", null);
  const byCountry = new Map<string, Set<string>>();
  for (const d of (data ?? []) as { country_code: string | null; beer_label: string | null }[]) {
    if (!d.country_code || !d.beer_label) continue;
    const s = byCountry.get(d.country_code) ?? new Set<string>();
    s.add(d.beer_label);
    byCountry.set(d.country_code, s);
  }
  return byCountry;
}
