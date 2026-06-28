import Link from "next/link";
import { getAllMemberships, getCurrentMembership } from "@/lib/membership";
import { BracketPicker } from "./BracketPicker";
import { createClient } from "@/lib/supabase/server";
import { computeMemberStats, assignFlavorLabels, type LeaderboardRow, type DrinkRow, type PickRow } from "@/lib/scoring";
import { WccIcon } from "@/components/ui/CurrencyIcon";
import { InfoChip } from "@/components/ui/InfoChip";

type SortKey = "wcc" | "drinks" | "stamps" | "picks";

type SortDef = {
  key: SortKey;
  label: string;
  icon: React.ReactNode | null;
  glyph: string | null;
};
const SORTS: SortDef[] = [
  { key: "wcc", label: "WCC", icon: <WccIcon size={14} />, glyph: null },
  { key: "drinks", label: "Drinks", icon: null, glyph: "🍻" },
  { key: "stamps", label: "Stamps", icon: null, glyph: "🛂" },
  { key: "picks", label: "Picks", icon: null, glyph: "🎯" },
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const sort: SortKey = (SORTS.find((s) => s.key === params.sort)?.key as SortKey) ?? "wcc";

  const [member, allMemberships] = await Promise.all([
    getCurrentMembership(),
    getAllMemberships(),
  ]);
  if (!member) return null;

  const supabase = await createClient();
  // 1. Bracket members
  const { data: members } = await supabase
    .from("wc_memberships")
    .select("user_id, display_name, role")
    .eq("group_id", member.groupId);
  const memberIds = (members ?? []).map((m) => m.user_id);

  // 2. Drinks are user-level (a pour in any bracket counts for that user
  //    across every bracket they're in), so fetch by user_id, not group.
  //    Picks stay per-bracket: each bracket can have its own stake/pick choice.
  const [{ data: drinks }, { data: picks }] = await Promise.all([
    memberIds.length
      ? supabase
          .from("wc_drinks")
          .select("user_id, match_id, country_code, beer_label")
          .in("user_id", memberIds)
      : Promise.resolve({ data: [] }),
    memberIds.length
      ? supabase
          .from("wc_picks")
          .select("user_id, match_id, pick, stake, settled_at, payout_wcc, payout_wcp")
          .in("user_id", memberIds)
      : Promise.resolve({ data: [] }),
  ]);

  const drinksByUser = new Map<string, DrinkRow[]>();
  for (const d of (drinks ?? []) as DrinkRow[] & { user_id: string }[]) {
    const u = (d as { user_id: string }).user_id;
    const arr = drinksByUser.get(u) ?? [];
    arr.push({ match_id: d.match_id, country_code: d.country_code, beer_label: d.beer_label });
    drinksByUser.set(u, arr);
  }

  const picksByUser = new Map<string, PickRow[]>();
  for (const p of (picks ?? []) as (PickRow & { user_id: string })[]) {
    const u = p.user_id;
    const arr = picksByUser.get(u) ?? [];
    arr.push({
      match_id: p.match_id,
      pick: p.pick,
      stake: p.stake,
      settled_at: p.settled_at,
      payout_wcc: p.payout_wcc,
      payout_wcp: p.payout_wcp,
    });
    picksByUser.set(u, arr);
  }

  // Comeback-multiplier bonuses + soft-reset adjustments, added on top of the
  // derived base. Tolerant of the tables not existing yet (pre scripts/010).
  const extraByUser = new Map<string, number>();
  if (memberIds.length) {
    const [cbRes, adjRes] = await Promise.all([
      supabase.from("wc_comeback_bonus").select("user_id, bonus_wcc").in("user_id", memberIds),
      supabase.from("wc_score_adjustments").select("user_id, delta").in("user_id", memberIds),
    ]);
    if (!cbRes.error)
      for (const r of (cbRes.data ?? []) as { user_id: string; bonus_wcc: number }[])
        extraByUser.set(r.user_id, (extraByUser.get(r.user_id) ?? 0) + Number(r.bonus_wcc));
    if (!adjRes.error)
      for (const r of (adjRes.data ?? []) as { user_id: string; delta: number }[])
        extraByUser.set(r.user_id, (extraByUser.get(r.user_id) ?? 0) + Number(r.delta));
  }

  const rows: LeaderboardRow[] = ((members ?? []) as { user_id: string; display_name: string; role: "host" | "member" }[]).map(
    (m) => {
      const myDrinks = drinksByUser.get(m.user_id) ?? [];
      const myPicks = picksByUser.get(m.user_id) ?? [];
      const stats = computeMemberStats(myDrinks, myPicks, extraByUser.get(m.user_id) ?? 0);
      const settled = myPicks.filter((p) => p.settled_at);
      const correct = settled.filter((p) => p.payout_wcp > 0).length;
      // single-match record
      const counts = new Map<number, number>();
      for (const d of myDrinks) {
        if (d.match_id != null) counts.set(d.match_id, (counts.get(d.match_id) ?? 0) + 1);
      }
      const singleMax = counts.size === 0 ? 0 : Math.max(...counts.values());
      return {
        userId: m.user_id,
        displayName: m.display_name,
        stats,
        picksMade: settled.length,
        picksCorrect: correct,
        singleMatchRecord: singleMax,
      };
    },
  );

  const labels = assignFlavorLabels(rows);

  // sort
  const sortVal = (r: LeaderboardRow): number => {
    switch (sort) {
      case "drinks": return r.stats.drinks;
      case "stamps": return r.stats.distinctBeers;
      case "picks": return r.picksCorrect;
      default: return r.stats.wcc;
    }
  };
  const sorted = rows.slice().sort((a, b) => sortVal(b) - sortVal(a));

  // assign tie-aware ranks: same sortVal -> same rank, prefixed "T-" if tied
  const ranked: (LeaderboardRow & { rank: string; rawRank: number })[] = [];
  let prev: number | null = null;
  let prevRank = 0;
  sorted.forEach((r, i) => {
    const v = sortVal(r);
    const rawRank = v === prev ? prevRank : i + 1;
    if (v !== prev) prevRank = rawRank;
    prev = v;
    ranked.push({ ...r, rank: "", rawRank });
  });
  // figure out which raw ranks have ties
  const tieRanks = new Set<number>();
  const seen = new Map<number, number>();
  for (const r of ranked) seen.set(r.rawRank, (seen.get(r.rawRank) ?? 0) + 1);
  for (const [rk, c] of seen) if (c > 1) tieRanks.add(rk);
  for (const r of ranked) r.rank = tieRanks.has(r.rawRank) ? `T-${r.rawRank}` : String(r.rawRank);

  return (
    <>
      <div className="appbar">
        <div style={{ flex: 1 }}>
          <div className="t-h1" style={{ display: "inline-flex", alignItems: "center" }}>
            Leaderboard
            <InfoChip label="How does the leaderboard rank?">
              Rank = <strong>WCC</strong> - cups earned from drinks plus winnings from correct picks. Tap a sort chip to view by any column. Ties show as <em>T-rank</em>.
            </InfoChip>
          </div>
          <div className="t-small muted">
            Your bracket · {member.memberCount} in
          </div>
        </div>
      </div>

      <div className="screen" style={{ gap: 12 }}>
        <BracketPicker
          options={allMemberships.map((g) => ({
            groupId: g.groupId,
            groupName: g.groupName,
            memberCount: g.memberCount,
          }))}
          activeId={member.groupId}
        />
        <div className="chip-row">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={s.key === "wcc" ? "/leaderboard" : `/leaderboard?sort=${s.key}`}
              className={`chip ${sort === s.key ? "is-active" : ""}`}
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {s.icon ?? (s.glyph ? <span aria-hidden>{s.glyph}</span> : null)}
              {s.label}
            </Link>
          ))}
        </div>

        {ranked.length === 0 ? (
          <div className="card empty-block" style={{ textAlign: "center" }}>
            <div className="empty-lead">Nothing tallied yet.</div>
            <div className="empty-sub">First whistle June 11. Pick to get on the board.</div>
          </div>
        ) : null}

        <div>
          {ranked.map((r) => {
            const isYou = r.userId === member.userId;
            const isTop = r.rawRank <= 3;
            return (
              <div
                key={r.userId}
                className={`lb-row ${isTop ? "top" : ""} ${isYou ? "you" : ""}`}
              >
                <span className="rank">{r.rank}</span>
                <div className="avatar">{r.displayName.slice(0, 1).toUpperCase()}</div>
                <div className="who">
                  <div className="name">{isYou ? "You" : r.displayName}</div>
                  {labels.get(r.userId) ? (
                    <div className="flavor">{labels.get(r.userId)}</div>
                  ) : null}
                  <div className="mini-stats tnum" style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", fontSize: 11 }}>
                    <span>🍻 {r.stats.drinks}</span>
                    <span>·</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><WccIcon size={11} /> {r.stats.wcc}</span>
                    <span>·</span>
                    <span>🛂 {r.stats.distinctBeers}</span>
                    <span>·</span>
                    <span>🎯 {r.picksCorrect}</span>
                  </div>
                </div>
                <div
                  className="total-num"
                  style={{ color: isYou ? "var(--burn)" : undefined, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {sort === "wcc" ? <WccIcon size={20} /> : null}
                  {sort === "drinks" ? <span aria-hidden style={{ fontSize: 18 }}>🍻</span> : null}
                  {sort === "stamps" ? <span aria-hidden style={{ fontSize: 18 }}>🛂</span> : null}
                  {sort === "picks" ? <span aria-hidden style={{ fontSize: 18 }}>🎯</span> : null}
                  {sortVal(r)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="t-small muted" style={{ textAlign: "center", marginTop: 4 }}>
          Live · pulls from the tap.
        </div>
        <div style={{ height: 16 }} />
      </div>
    </>
  );
}
