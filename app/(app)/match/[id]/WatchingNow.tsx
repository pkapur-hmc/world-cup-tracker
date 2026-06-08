"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { watchingPingAction } from "./actions";
import { WccIcon } from "@/components/ui/CurrencyIcon";

export type WatchingMember = {
  userId: string;
  displayName: string;
  flag: string;
  drinkCount: number;
  watching: boolean;
  isYou: boolean;
};

export function WatchingNow({
  matchId,
  userIds,
  initialMembers,
}: {
  matchId: number;
  userIds: string[];
  initialMembers: WatchingMember[];
}) {
  const [members, setMembers] = useState<WatchingMember[]>(initialMembers);
  const userIdsKey = userIds.join(",");

  // Ping presence on mount + every 60s
  useEffect(() => {
    watchingPingAction(matchId);
    const ping = setInterval(() => {
      watchingPingAction(matchId);
    }, 60_000);
    return () => clearInterval(ping);
  }, [matchId]);

  // Poll for latest watching+drinks every 10s. Cross-bracket: filters by
  // user_id IN (...) instead of by group_id, so you see everyone you've ever
  // bracketed with in any of your brackets.
  useEffect(() => {
    if (!userIdsKey) return;
    const ids = userIdsKey.split(",");
    const supabase = createClient();
    let cancelled = false;
    async function refresh() {
      const sinceIso = new Date(Date.now() - 5 * 60_000).toISOString();

      const [eventsRes, drinksRes] = await Promise.all([
        supabase
          .from("wc_events")
          .select("user_id")
          .in("user_id", ids)
          .eq("match_id", matchId)
          .eq("kind", "watching")
          .gte("created_at", sinceIso),
        supabase
          .from("wc_drinks")
          .select("user_id")
          .in("user_id", ids)
          .eq("match_id", matchId),
      ]);
      if (cancelled) return;

      const watchingSet = new Set<string>(
        ((eventsRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id),
      );
      const counts = new Map<string, number>();
      for (const d of (drinksRes.data ?? []) as { user_id: string }[]) {
        counts.set(d.user_id, (counts.get(d.user_id) ?? 0) + 1);
      }

      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          watching: watchingSet.has(m.userId),
          drinkCount: counts.get(m.userId) ?? 0,
        })),
      );
    }
    refresh();
    const t = setInterval(refresh, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [matchId, userIdsKey]);

  const maxCount = Math.max(1, ...members.map((m) => m.drinkCount));
  const watchingCount = members.filter((m) => m.watching).length;
  const totalDrinks = members.reduce((s, m) => s + m.drinkCount, 0);

  return (
    <div className="card">
      <div className="section-label" style={{ marginBottom: 6 }}>
        <span className="caps-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          🏆 Your people
        </span>
        <span className="t-small muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {watchingCount} of {members.length} watching · <WccIcon size={12} /> {totalDrinks}
        </span>
      </div>
      {members
        .slice()
        .sort((a, b) => {
          if (a.isYou !== b.isYou) return a.isYou ? -1 : 1;
          if (a.watching !== b.watching) return a.watching ? -1 : 1;
          return b.drinkCount - a.drinkCount;
        })
        .map((m) => {
          const widthPct = m.watching ? Math.round((m.drinkCount / maxCount) * 100) : 0;
          return (
            <div
              key={m.userId}
              className={`drink-row ${m.isYou ? "you" : ""}`}
              style={m.watching ? undefined : { opacity: 0.5 }}
            >
              <span className="flag" style={m.watching ? undefined : { filter: "grayscale(1)" }}>
                {m.flag || "·"}
              </span>
              <span className="who">
                {m.displayName}
                {m.watching ? "" : " · not in"}
              </span>
              <span className="bar-wrap">
                {m.watching ? (
                  <span
                    className="bar"
                    style={{ width: `${widthPct}%`, transition: "width 300ms ease" }}
                  />
                ) : null}
              </span>
              <span className="count" style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                {m.watching ? (
                  <>
                    <WccIcon size={14} />
                    {m.drinkCount}
                  </>
                ) : (
                  "-"
                )}
              </span>
            </div>
          );
        })}
    </div>
  );
}
