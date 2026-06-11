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
  wcc: number;
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
          .select("user_id, country_code")
          .in("user_id", ids)
          .eq("match_id", matchId),
      ]);
      if (cancelled) return;

      const watchingSet = new Set<string>(
        ((eventsRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id),
      );
      const tally = new Map<string, { drinks: number; wcc: number }>();
      for (const d of (drinksRes.data ?? []) as { user_id: string; country_code: string | null }[]) {
        const cur = tally.get(d.user_id) ?? { drinks: 0, wcc: 0 };
        cur.drinks += 1;
        cur.wcc += d.country_code ? 2 : 1;
        tally.set(d.user_id, cur);
      }

      setMembers((prev) =>
        prev.map((m) => ({
          ...m,
          watching: watchingSet.has(m.userId),
          drinkCount: tally.get(m.userId)?.drinks ?? 0,
          wcc: tally.get(m.userId)?.wcc ?? 0,
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

  // Show anyone who's earned WCC on this match, plus you. The "watching" ping
  // is just a live presence accent now - it doesn't gate whether someone (or
  // their cups) appears.
  const shown = members.filter((m) => m.isYou || m.wcc > 0);
  const maxWcc = Math.max(1, ...shown.map((m) => m.wcc));
  const watchingCount = members.filter((m) => m.watching).length;
  const totalWcc = members.reduce((s, m) => s + m.wcc, 0);

  return (
    <div className="card">
      <div className="section-label" style={{ marginBottom: 6 }}>
        <span className="caps-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          🏆 Your people
        </span>
        <span className="t-small muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {watchingCount} watching · <WccIcon size={12} /> {totalWcc}
        </span>
      </div>
      {shown
        .slice()
        .sort((a, b) => {
          if (b.wcc !== a.wcc) return b.wcc - a.wcc;
          return a.isYou ? -1 : b.isYou ? 1 : 0;
        })
        .map((m) => {
          const widthPct = Math.round((m.wcc / maxWcc) * 100);
          return (
            <div key={m.userId} className={`drink-row ${m.isYou ? "you" : ""}`}>
              <span className="flag">{m.flag || "·"}</span>
              <span className="who" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {m.displayName}
                {m.watching ? (
                  <span
                    aria-label="watching now"
                    title="watching now"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "var(--live)",
                      display: "inline-block",
                      flex: "0 0 auto",
                    }}
                  />
                ) : null}
              </span>
              <span className="bar-wrap">
                <span
                  className="bar"
                  style={{ width: `${widthPct}%`, transition: "width 300ms ease" }}
                />
              </span>
              <span className="count" style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                <WccIcon size={14} />
                {m.wcc}
              </span>
            </div>
          );
        })}
    </div>
  );
}
