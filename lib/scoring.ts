/**
 * Pure scoring for The World Cup Cup.
 * One currency: WCC (World Cup Cups). All numbers derived from raw rows -
 * no aggregate columns to keep in sync.
 *
 *   WCC = basic drinks (1 each) + country beers (2 each)
 *         - sum(stakes) + sum(payout_wcc from refunds)
 *         + sum(payout_wcp from won picks)
 *         + 5 per completed country passport (depth)
 *         + 5 for every 5 distinct countries stamped (breadth)
 *   stamps = distinct country_codes ever drunk (lifetime, not per-group)
 *
 * Country-beer multiplier: tracking a country-specific beer is harder and more
 * intentional than just tapping +1, so it's worth twice as much WCC.
 *
 * Passport bonuses (both lifetime, both derived - mirror any rule change in
 * scripts/007, place_pick budget):
 *   - depth:   stamp EVERY beer on a country's list -> +5 WCC, per country.
 *   - breadth: every 5 distinct countries you've stamped -> +5 WCC. Rewards
 *              exploring widely as a counterweight to completing one deeply.
 *
 * Picks: stake WCC on a side; a correct pick pays 1 + 2*stake WCC (the stake
 * itself is spent). The winnings live in the `payout_wcp` column - the name
 * predates the single-currency merge, but the value is plain WCC.
 */

import { COUNTRY_BEERS } from "@/data/country-beers";

export const COUNTRY_BEER_WCC = 2;
export const PASSPORT_COMPLETE_WCC = 5;
export const PASSPORT_BREADTH_EVERY = 5; // countries per breadth milestone
export const PASSPORT_BREADTH_WCC = 5; // WCC per milestone

export type DrinkRow = {
  match_id: number | null;
  country_code: string | null;
  beer_label: string | null;
};

export type PickRow = {
  match_id: number;
  pick: "A" | "D" | "B";
  stake: number;
  settled_at: string | null;
  payout_wcc: number; // refund on a postponed match
  payout_wcp: number; // winnings on a correct pick (denominated in WCC)
};

export type MemberStats = {
  drinks: number;
  wcc: number;
  /** Distinct COUNTRIES stamped (one per country). Drives the X/48 passport
   *  progress and the breadth bonus. */
  stamps: number;
  /** Distinct BEERS collected: unique (country, beer_label) pairs. Each specific
   *  country beer counts once; repeats and generic country pours don't add. This
   *  is the "Stamps" number shown on the leaderboard / status cards. */
  distinctBeers: number;
  /** Countries whose passport is complete (every listed beer stamped). */
  passports: number;
};

export function drinksCount(drinks: DrinkRow[]): number {
  return drinks.length;
}

/** Country codes whose passport is complete: every beer on the country's
 *  curated list has been stamped at least once. Labels are matched within
 *  their own country (beer names repeat across countries - Brahma, Skol...). */
export function completedPassports(drinks: DrinkRow[]): Set<string> {
  const labelsByCountry = new Map<string, Set<string>>();
  for (const d of drinks) {
    if (!d.country_code || !d.beer_label) continue;
    const s = labelsByCountry.get(d.country_code) ?? new Set<string>();
    s.add(d.beer_label);
    labelsByCountry.set(d.country_code, s);
  }
  const done = new Set<string>();
  for (const [code, labels] of labelsByCountry) {
    const list = COUNTRY_BEERS[code];
    if (!list || list.length === 0) continue;
    if (list.every((b) => labels.has(b.name))) done.add(code);
  }
  return done;
}

/** Breadth bonus: +5 WCC for every 5 distinct countries stamped. */
export function breadthBonus(countriesStamped: number): number {
  return Math.floor(countriesStamped / PASSPORT_BREADTH_EVERY) * PASSPORT_BREADTH_WCC;
}

/** The single WCC number: earned from drinks, minus stakes spent, plus refunds,
 *  pick winnings, and passport bonuses (depth + breadth). Doubles as the
 *  spendable balance and the leaderboard score. */
export function wccTotal(drinks: DrinkRow[], picks: PickRow[]): number {
  const earned = drinks.reduce(
    (s, d) => s + (d.country_code ? COUNTRY_BEER_WCC : 1),
    0,
  );
  const stakesSpent = picks.reduce((s, p) => s + (p.settled_at ? p.stake : 0), 0);
  const refunds = picks.reduce((s, p) => s + p.payout_wcc, 0);
  const winnings = picks.reduce((s, p) => s + p.payout_wcp, 0);
  const depthBonus = completedPassports(drinks).size * PASSPORT_COMPLETE_WCC;
  const breadth = breadthBonus(stampSet(drinks).size);
  return earned - stakesSpent + refunds + winnings + depthBonus + breadth;
}

/** Distinct countries the user has a real passport stamp in. A stamp requires
 *  a specific beer_label - a generic "any country beer" (country tagged, no
 *  label) earns +2 WCC but does NOT count here, toward the passport, or toward
 *  the breadth bonus. Mirrors the beer_label filter in scripts/007. */
export function stampSet(drinks: DrinkRow[]): Set<string> {
  const s = new Set<string>();
  for (const d of drinks) if (d.country_code && d.beer_label) s.add(d.country_code);
  return s;
}

/** Total distinct passport stamps collected = unique (country, beer_label)
 *  pairs. Three different Korean beers count as 3; the same Korean beer twice
 *  counts as 1. Generic country pours (no beer_label) don't count. This is the
 *  "Stamps" number on the leaderboard - purely a display tally, separate from
 *  the breadth bonus, which still rides on distinct countries (stampSet). */
export function distinctStampsCount(drinks: DrinkRow[]): number {
  const s = new Set<string>();
  for (const d of drinks)
    if (d.country_code && d.beer_label) s.add(`${d.country_code}|${d.beer_label}`);
  return s.size;
}

export function computeMemberStats(
  drinks: DrinkRow[],
  picks: PickRow[],
): MemberStats {
  return {
    drinks: drinksCount(drinks),
    wcc: wccTotal(drinks, picks),
    stamps: stampSet(drinks).size,
    distinctBeers: distinctStampsCount(drinks),
    passports: completedPassports(drinks).size,
  };
}

// ============================================================
// Flavor labels (leaderboard accents)
// ============================================================

export type LeaderboardRow = {
  userId: string;
  displayName: string;
  stats: MemberStats;
  picksMade: number;
  picksCorrect: number;
  singleMatchRecord: number;
};

/**
 * Assign at most one flavor label per user. Priority:
 *   1. "the smart one"  highest pick accuracy, min 5 picks
 *   2. "the tourist"    most stamps, min 4 stamps
 *   3. "the legend"     highest single-match drinks, min 6 in one match
 * A user already labeled isn't re-labeled.
 */
export function assignFlavorLabels(
  rows: LeaderboardRow[],
): Map<string, string> {
  const labels = new Map<string, string>();
  if (rows.length === 0) return labels;

  const smartEligible = rows.filter((r) => r.picksCorrect > 0);
  if (smartEligible.length > 0) {
    const smart = smartEligible.reduce((best, r) =>
      r.picksCorrect > best.picksCorrect ? r : best,
    );
    labels.set(smart.userId, "the smart one");
  }

  const tourist = rows.reduce((best, r) =>
    r.stats.distinctBeers > best.stats.distinctBeers ? r : best,
  );
  if (tourist.stats.distinctBeers >= 4 && !labels.has(tourist.userId)) {
    labels.set(tourist.userId, "the tourist");
  }

  const legend = rows.reduce((best, r) =>
    r.singleMatchRecord > best.singleMatchRecord ? r : best,
  );
  if (legend.singleMatchRecord >= 6 && !labels.has(legend.userId)) {
    labels.set(legend.userId, "the legend");
  }

  return labels;
}

// ============================================================
// Pick outcome (client-side UI badges)
// ============================================================

export type PickOutcome = "pending" | "correct" | "wrong" | "refunded";

export function pickOutcome(
  pick: PickRow,
  match: {
    status: string;
    winner_code: string | null;
    team_a_code: string | null;
    team_b_code: string | null;
  },
): PickOutcome {
  if (pick.settled_at && pick.payout_wcc > 0) return "refunded";
  if (!pick.settled_at) return "pending";
  const correct =
    (pick.pick === "A" && match.winner_code === match.team_a_code) ||
    (pick.pick === "B" && match.winner_code === match.team_b_code) ||
    (pick.pick === "D" && match.winner_code === null);
  return correct ? "correct" : "wrong";
}
