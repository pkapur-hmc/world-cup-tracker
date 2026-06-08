/**
 * Pure scoring functions for The World Cup Cup.
 * All numbers derived from raw rows - no aggregate columns to keep in sync.
 *
 *   WCC = drinks count - sum(stakes) + sum(payout_wcc from refunds)
 *   WCP = sum(payout_wcp on settled picks) + count(country-beer drinks)
 *   total = WCC + WCP
 *   stamps = distinct country_codes ever drunk (lifetime, not per-group)
 */

export type DrinkRow = {
  match_id: number | null;
  country_code: string | null;
};

export type MatchLite = {
  id: number;
  team_a_code: string | null;
  team_b_code: string | null;
};

export type PickRow = {
  match_id: number;
  pick: "A" | "D" | "B";
  stake: number;
  settled_at: string | null;
  payout_wcc: number;
  payout_wcp: number;
};

export type MemberStats = {
  drinks: number;
  wcc: number;
  wcp: number;
  total: number;
  stamps: number;
};

export function drinksCount(drinks: DrinkRow[]): number {
  return drinks.length;
}

export function wccBalance(drinks: DrinkRow[], picks: PickRow[]): number {
  const earned = drinks.length;
  const stakesSpent = picks.reduce((s, p) => s + p.stake, 0);
  const refunds = picks.reduce((s, p) => s + p.payout_wcc, 0);
  return earned - stakesSpent + refunds;
}

export function wcpTotal(
  drinks: DrinkRow[],
  picks: PickRow[],
  matchesById: Map<number, MatchLite>,
): number {
  const fromPicks = picks.reduce((s, p) => s + p.payout_wcp, 0);
  const fromBeers = drinks.reduce((s, d) => {
    if (!d.country_code || !d.match_id) return s;
    const m = matchesById.get(d.match_id);
    if (!m) return s;
    if (d.country_code === m.team_a_code || d.country_code === m.team_b_code) {
      return s + 1;
    }
    return s;
  }, 0);
  return fromPicks + fromBeers;
}

export function headlineTotal(wcc: number, wcp: number): number {
  return wcc + wcp;
}

export function stampSet(drinks: DrinkRow[]): Set<string> {
  const s = new Set<string>();
  for (const d of drinks) if (d.country_code) s.add(d.country_code);
  return s;
}

export function computeMemberStats(
  drinks: DrinkRow[],
  picks: PickRow[],
  matchesById: Map<number, MatchLite>,
): MemberStats {
  const wcc = wccBalance(drinks, picks);
  const wcp = wcpTotal(drinks, picks, matchesById);
  return {
    drinks: drinksCount(drinks),
    wcc,
    wcp,
    total: headlineTotal(wcc, wcp),
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

export function payoutBreakdown(pick: PickRow, outcome: PickOutcome): string {
  if (outcome === "refunded")
    return `refunded - -${pick.stake} +${pick.stake} WCC`;
  if (outcome === "pending") return "pending";
  if (outcome === "correct") {
    const base = 1;
    const bonus = 2 * pick.stake;
    const stakeLine = pick.stake > 0 ? `, -${pick.stake} WCC` : "";
    return `+${base + bonus} WCP${stakeLine}  (${base} base${
      pick.stake > 0 ? ` + ${bonus} stake` : ""
    })`;
  }
  return pick.stake > 0 ? `-${pick.stake} WCC` : "no payout";
}
