/**
 * Pure scoring for The World Cup Cup.
 * One currency: WCC (World Cup Cups). All numbers derived from raw rows -
 * no aggregate columns to keep in sync.
 *
 *   WCC = basic drinks (1 each) + country beers (2 each)
 *         - sum(stakes) + sum(payout_wcc from refunds)
 *         + sum(payout_wcp from won picks)
 *   stamps = distinct country_codes ever drunk (lifetime, not per-group)
 *
 * Country-beer multiplier: tracking a country-specific beer is harder and more
 * intentional than just tapping +1, so it's worth twice as much WCC.
 *
 * Picks: stake WCC on a side; a correct pick pays 1 + 2*stake WCC (the stake
 * itself is spent). The winnings live in the `payout_wcp` column - the name
 * predates the single-currency merge, but the value is plain WCC.
 */

export const COUNTRY_BEER_WCC = 2;

export type DrinkRow = {
  match_id: number | null;
  country_code: string | null;
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
  stamps: number;
};

export function drinksCount(drinks: DrinkRow[]): number {
  return drinks.length;
}

/** The single WCC number: earned from drinks, minus stakes spent, plus refunds
 *  and pick winnings. Doubles as the spendable balance and the leaderboard
 *  score. */
export function wccTotal(drinks: DrinkRow[], picks: PickRow[]): number {
  const earned = drinks.reduce(
    (s, d) => s + (d.country_code ? COUNTRY_BEER_WCC : 1),
    0,
  );
  const stakesSpent = picks.reduce((s, p) => s + p.stake, 0);
  const refunds = picks.reduce((s, p) => s + p.payout_wcc, 0);
  const winnings = picks.reduce((s, p) => s + p.payout_wcp, 0);
  return earned - stakesSpent + refunds + winnings;
}

export function stampSet(drinks: DrinkRow[]): Set<string> {
  const s = new Set<string>();
  for (const d of drinks) if (d.country_code) s.add(d.country_code);
  return s;
}

export function computeMemberStats(
  drinks: DrinkRow[],
  picks: PickRow[],
): MemberStats {
  return {
    drinks: drinksCount(drinks),
    wcc: wccTotal(drinks, picks),
    stamps: stampSet(drinks).size,
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

  const smartEligible = rows.filter((r) => r.picksMade >= 5);
  if (smartEligible.length > 0) {
    const smart = smartEligible.reduce((best, r) =>
      r.picksCorrect / r.picksMade > best.picksCorrect / best.picksMade
        ? r
        : best,
    );
    labels.set(smart.userId, "the smart one");
  }

  const tourist = rows.reduce((best, r) =>
    r.stats.stamps > best.stats.stamps ? r : best,
  );
  if (tourist.stats.stamps >= 4 && !labels.has(tourist.userId)) {
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
