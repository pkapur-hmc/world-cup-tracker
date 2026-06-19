"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

export type UpNextTeam = {
  code: string;
  name: string;
  flag: string;
  needed: string[];
  total: number;
  done: number;
};
export type UpNextMatch = {
  id: number;
  kickoffAt: string;
  teams: UpNextTeam[];
};

/** Local-zone YYYY-MM-DD. "UTC" for SSR + first render, viewer zone after. */
function dayKey(iso: string, tz: string | undefined): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
}

function dayLabel(iso: string, tz: string | undefined): string {
  const now = Date.now();
  const k = dayKey(iso, tz);
  const todayK = dayKey(new Date(now).toISOString(), tz);
  const tomK = dayKey(new Date(now + 86_400_000).toISOString(), tz);
  const monthDay = new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
  if (k === todayK) return `Today · ${monthDay}`;
  if (k === tomK) return `Tomorrow · ${monthDay}`;
  const weekday = new Date(iso).toLocaleDateString(undefined, { weekday: "long", timeZone: tz });
  return `${weekday} · ${monthDay}`;
}

const MAX_DAYS = 3;

/**
 * "Up next" plan-ahead block for the passport: the next few days of matches,
 * grouped by day in the viewer's zone, listing each country playing and the
 * beers still missing from their passport - so it's easy to plan what to grab
 * without drilling into each country first.
 */
export function UpNext({ matches }: { matches: UpNextMatch[] }) {
  const tz = useSyncExternalStore<string | undefined>(
    () => () => {},
    () => undefined,
    () => "UTC",
  );

  if (matches.length === 0) return null;

  // Group by day (matches arrive in kickoff order), deduping a country that
  // somehow appears twice in a day.
  const days: { key: string; label: string; teams: UpNextTeam[] }[] = [];
  for (const m of matches) {
    const k = dayKey(m.kickoffAt, tz);
    let g = days.find((d) => d.key === k);
    if (!g) {
      g = { key: k, label: dayLabel(m.kickoffAt, tz), teams: [] };
      days.push(g);
    }
    for (const t of m.teams) {
      if (!g.teams.some((x) => x.code === t.code)) g.teams.push(t);
    }
  }
  const shown = days.slice(0, MAX_DAYS);

  return (
    <div>
      <div className="section-label">
        <span className="caps-label">📅 Up next · plan ahead</span>
        <Link
          href="/schedule"
          className="t-small"
          style={{ color: "var(--burn)", fontWeight: 700, textDecoration: "none" }}
        >
          Full schedule →
        </Link>
      </div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {shown.map((d) => (
          <div key={d.key}>
            <div className="caps-label" style={{ marginBottom: 8 }}>{d.label}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.teams.map((t) => (
                <Link key={t.code} href={`/team/${t.code}`} className="upnext-row">
                  <span className="upnext-flag" aria-hidden>{t.flag}</span>
                  <span className="upnext-body">
                    <span className="upnext-name">{t.name}</span>
                    {t.needed.length === 0 ? (
                      <span className="upnext-done">✓ all {t.total} collected</span>
                    ) : (
                      <span className="beer-need-chips">
                        {t.needed.map((n) => (
                          <span key={n} className="beer-need-chip">{n}</span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="upnext-count tnum">{t.done}/{t.total}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
