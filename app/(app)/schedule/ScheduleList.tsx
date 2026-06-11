"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { Match } from "@/lib/fixtures";
import { matchPhase } from "@/lib/match-phase";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { colorFor } from "@/data/country-colors";
import { PickPanel } from "@/components/ui/PickPanel";
import { LocalTime } from "@/components/ui/LocalTime";

export type MyPick = { pick: "A" | "D" | "B"; stake: number };
export type ScheduleItem = {
  match: Match;
  myPick: MyPick | null;
  city: string | null;
};

function flag(code: string | null) {
  return code ? FLAG_EMOJI[code] ?? "" : "";
}

/** Local-zone YYYY-MM-DD for an instant. `tz` is "UTC" for the deterministic
 *  SSR/first render and undefined (the viewer's zone) after mount. */
function dayKey(iso: string, tz: string | undefined): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
}

function dayLabelParts(
  iso: string,
  tz: string | undefined,
): { emph: string | null; rest: string } {
  const now = Date.now();
  const k = dayKey(iso, tz);
  const todayK = dayKey(new Date(now).toISOString(), tz);
  const tomK = dayKey(new Date(now + 86_400_000).toISOString(), tz);
  const yesK = dayKey(new Date(now - 86_400_000).toISOString(), tz);
  const d = new Date(iso);
  const monthDay = d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
  if (k === todayK) return { emph: "Today", rest: ` · ${monthDay}` };
  if (k === tomK) return { emph: "Tomorrow", rest: ` · ${monthDay}` };
  if (k === yesK) return { emph: "Yesterday", rest: ` · ${monthDay}` };
  const weekday = d.toLocaleDateString(undefined, { weekday: "long", timeZone: tz });
  return { emph: weekday, rest: ` · ${monthDay}` };
}

function MatchCard({ item }: { item: ScheduleItem }) {
  const { match, myPick, city } = item;
  const tA = match.team_a_code ?? "TBD";
  const tB = match.team_b_code ?? "TBD";

  const phase = matchPhase(match);

  let badge: React.ReactNode;
  let meta: string;
  if (phase === "live") {
    badge = (
      <span className="badge live">
        <span className="dot" />
        Live
      </span>
    );
    meta = "live now";
  } else if (match.status === "final") {
    badge = <span className="badge final">Final</span>;
    meta = "ended";
  } else if (match.status === "postponed") {
    badge = <span className="badge final">Postponed</span>;
    meta = "rescheduling";
  } else if (phase === "post") {
    badge = <span className="badge final">Ended</span>;
    meta = "ended";
  } else {
    badge = (
      <span className="badge time">
        ⏰ <LocalTime iso={match.kickoff_at} mode="time" />
      </span>
    );
    meta = "pickable";
  }

  const stageLabel =
    match.stage === "group"
      ? `Group ${match.group_letter ?? ""}`
      : match.stage.toUpperCase();

  const showScore = phase === "live" || match.status === "final";

  // A bet tints the whole card the picked country's color (exactly like the
  // home page's "next up" card). A draw pick blends both teams' tints with
  // dual edge accents - same language as the match page's draw hero.
  const pickedCode =
    myPick?.pick === "A"
      ? match.team_a_code
      : myPick?.pick === "B"
        ? match.team_b_code
        : null;
  const accent = colorFor(pickedCode);
  const drawPicked = myPick?.pick === "D";
  const teamAColor = match.team_a_code ? colorFor(match.team_a_code) : null;
  const teamBColor = match.team_b_code ? colorFor(match.team_b_code) : null;

  const cardStyle: React.CSSProperties | undefined = pickedCode
    ? { borderLeft: `4px solid ${accent.primary}`, background: accent.tint }
    : drawPicked && teamAColor && teamBColor
      ? {
          borderLeft: `4px solid ${teamAColor.primary}`,
          borderRight: `4px solid ${teamBColor.primary}`,
          background: `linear-gradient(90deg, ${teamAColor.tint} 0%, ${teamBColor.tint} 100%)`,
        }
      : undefined;

  return (
    <Link href={`/match/${match.id}`} className="match-card" style={cardStyle}>
      <div>
        <div className="mc-top">
          {badge}
          <span className="mc-stage">{stageLabel} · M{match.id}</span>
        </div>
        <div className="teams">
          <span className="flag">{flag(match.team_a_code)}</span>
          <span>{tA}</span>
          {showScore ? (
            <>
              <span className="score tnum">{match.score_a ?? 0}</span>
              <span className="vs">-</span>
              <span className="score tnum">{match.score_b ?? 0}</span>
            </>
          ) : (
            <span className="vs">vs</span>
          )}
          <span>{tB}</span>
          <span className="flag">{flag(match.team_b_code)}</span>
        </div>
        <div className="meta">
          {meta}
          {city ? <> · {city}</> : null}
        </div>
        {myPick ? (
          <PickPanel
            teamACode={match.team_a_code}
            teamBCode={match.team_b_code}
            pick={myPick.pick}
            stake={myPick.stake}
            style={{ marginTop: 10 }}
          />
        ) : null}
      </div>
      <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

/**
 * Renders the chronologically-ordered matches, bucketed into day sections in
 * the VIEWER'S local timezone. Grouping by day is timezone-dependent and so
 * must happen on the client: a match at 02:00 UTC belongs to the previous
 * evening in the Americas. We render with tz="UTC" for SSR + the first client
 * render (deterministic, matches the server HTML), then flip to the local zone
 * after mount - the structural regroup happens post-hydration, so there's no
 * hydration mismatch.
 */
export function ScheduleList({ items }: { items: ScheduleItem[] }) {
  // "UTC" for SSR + the first client render (deterministic, matches the server
  // HTML), then the viewer's own zone (undefined) once hydrated - same two-phase
  // trick as <LocalTime>, kept lint-clean via useSyncExternalStore.
  const tz = useSyncExternalStore<string | undefined>(
    () => () => {},
    () => undefined,
    () => "UTC",
  );

  if (items.length === 0) {
    return (
      <div className="card empty-block" style={{ textAlign: "center" }}>
        <div className="empty-lead">Nothing scheduled.</div>
        <div className="empty-sub">Try a different stage.</div>
      </div>
    );
  }

  // Items arrive globally sorted by kickoff, so consecutive same-day items form
  // each section and the sections stay chronological.
  const groups: { key: string; items: ScheduleItem[] }[] = [];
  for (const it of items) {
    const k = dayKey(it.match.kickoff_at, tz);
    const last = groups[groups.length - 1];
    if (last && last.key === k) last.items.push(it);
    else groups.push({ key: k, items: [it] });
  }

  return (
    <>
      {groups.map((g) => {
        const { emph, rest } = dayLabelParts(g.items[0].match.kickoff_at, tz);
        return (
          <div key={g.key}>
            <div className="day-label" style={{ marginTop: 16 }} suppressHydrationWarning>
              {emph ? <span className="day-emph">{emph}</span> : null}
              {rest}
            </div>
            {g.items.map((it) => (
              <div key={it.match.id} style={{ marginTop: 10 }}>
                <MatchCard item={it} />
              </div>
            ))}
          </div>
        );
      })}
      <div style={{ height: 16 }} />
    </>
  );
}
