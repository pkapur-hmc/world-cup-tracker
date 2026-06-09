import Link from "next/link";
import { getMatchesByDay, type Match } from "@/lib/fixtures";
import { getCurrentMembership } from "@/lib/membership";
import { getUserPicksByMatch } from "@/lib/picks";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { PickPanel } from "@/components/ui/PickPanel";

type MyPick = { pick: "A" | "D" | "B"; stake: number };

const STAGES: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "group", label: "Group" },
  { key: "r32", label: "R32" },
  { key: "r16", label: "R16" },
  { key: "qf", label: "QF" },
  { key: "sf", label: "SF" },
  { key: "final", label: "Final" },
];

function flag(code: string | null) {
  return code ? FLAG_EMOJI[code] ?? "" : "";
}

function dayLabel(dayIso: string): { emph: string | null; rest: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dayIso + "T00:00:00Z");
  const dLocal = new Date(d.getTime() + d.getTimezoneOffset() * 60_000);
  const diffDays = Math.round(
    (dLocal.getTime() - today.getTime()) / 86_400_000,
  );

  const monthDay = dLocal.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
  const weekday = dLocal.toLocaleDateString(undefined, { weekday: "long" });
  if (diffDays === 0) return { emph: "Today", rest: ` · ${monthDay}` };
  if (diffDays === 1) return { emph: "Tomorrow", rest: ` · ${monthDay}` };
  if (diffDays === -1) return { emph: "Yesterday", rest: ` · ${monthDay}` };
  return { emph: weekday, rest: ` · ${monthDay}` };
}

function MatchCard({ match, myPick }: { match: Match; myPick?: MyPick }) {
  const tA = match.team_a_code ?? "TBD";
  const tB = match.team_b_code ?? "TBD";
  const time = new Date(match.kickoff_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  let badge: React.ReactNode;
  let meta: string;
  if (match.status === "live") {
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
  } else {
    badge = <span className="badge time">⏰ {time}</span>;
    meta = "pickable";
  }

  const stageLabel =
    match.stage === "group"
      ? `Group ${match.group_letter ?? ""}`
      : match.stage.toUpperCase();

  const showScore = match.status === "live" || match.status === "final";

  return (
    <Link href={`/match/${match.id}`} className="match-card">
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
        <div className="meta">{meta}</div>
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

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const params = await searchParams;
  const activeStage = STAGES.find((s) => s.key === params.stage)?.key ?? "";

  const member = await getCurrentMembership();
  const [byDay, picksByMatch] = await Promise.all([
    getMatchesByDay(activeStage ? (activeStage as Match["stage"]) : undefined),
    member ? getUserPicksByMatch(member.userId) : Promise.resolve(new Map<number, MyPick>()),
  ]);
  const dayKeys = Array.from(byDay.keys()).sort();

  return (
    <>
      <div className="appbar">
        <div style={{ flex: 1 }}>
          <div className="t-h1">Schedule</div>
          <div className="t-small muted">
            {Array.from(byDay.values()).reduce((s, arr) => s + arr.length, 0)} matches · Jun 11 - Jul 19
          </div>
        </div>
      </div>

      <div className="chip-row">
        {STAGES.map((s) => (
          <Link
            key={s.key || "all"}
            href={s.key ? `/schedule?stage=${s.key}` : "/schedule"}
            className={`chip ${activeStage === s.key ? "is-active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="screen" style={{ gap: 0 }}>
        {dayKeys.length === 0 ? (
          <div className="card empty-block" style={{ textAlign: "center" }}>
            <div className="empty-lead">Nothing scheduled.</div>
            <div className="empty-sub">Try a different stage.</div>
          </div>
        ) : null}

        {dayKeys.map((day) => {
          const matches = byDay.get(day) ?? [];
          const { emph, rest } = dayLabel(day);
          return (
            <div key={day}>
              <div className="day-label" style={{ marginTop: 16 }}>
                {emph ? <span className="day-emph">{emph}</span> : null}
                {rest}
              </div>
              {matches.map((m) => (
                <div key={m.id} style={{ marginTop: 10 }}>
                  <MatchCard match={m} myPick={picksByMatch.get(m.id)} />
                </div>
              ))}
            </div>
          );
        })}
        <div style={{ height: 16 }} />
      </div>
    </>
  );
}
