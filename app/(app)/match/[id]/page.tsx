import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchById, type Match } from "@/lib/fixtures";
import { BackButton } from "@/components/ui/BackButton";
import { getCurrentMembership, getCrossBracketMembers } from "@/lib/membership";
import { getMemberStats } from "@/lib/stats";
import {
  getPicksForUsersInMatch,
  getDrinksForUsersInMatch,
  getWatchingForUsersInMatch,
  getUserStampedBeers,
  getUserBeerCountsForMatch,
} from "@/lib/picks";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { COUNTRY_BEERS } from "@/data/country-beers";
import { colorFor } from "@/data/country-colors";
import { PourButton } from "./PourButton";
import { BeerStampRail } from "./BeerStampRail";
import { WatchingNow, type WatchingMember } from "./WatchingNow";
import { PreMatchInteractive } from "./PreMatchInteractive";
import { WccIcon, WcpIcon } from "@/components/ui/CurrencyIcon";

function flag(code: string | null) {
  return code ? FLAG_EMOJI[code] ?? "" : "";
}

function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function countdownTo(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "kickoff!";
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

function MatchAppbar({ match }: { match: Match }) {
  const stageLabel =
    match.stage === "group"
      ? `Group ${match.group_letter ?? ""}`
      : match.stage.toUpperCase();
  return (
    <div className="appbar" style={{ paddingBottom: 6 }}>
      <BackButton fallback="/" />
      <div style={{ flex: 1 }}>
        <div className="caps-label">
          {stageLabel} · M{match.id}
        </div>
      </div>
      {match.status === "live" ? (
        <span className="badge live">
          <span className="dot" />
          Live
        </span>
      ) : null}
    </div>
  );
}

function TeamChunk({
  code,
  accentTeams = false,
}: {
  code: string | null;
  accentTeams?: boolean;
}) {
  const c = accentTeams && code ? colorFor(code) : null;
  const inner = (
    <>
      <span className="flag xl">{flag(code)}</span>
      <span className="t-sub">{code ?? "TBD"}</span>
    </>
  );
  const wrapStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    ...(c
      ? {
          background: c.tint,
          borderBottom: `3px solid ${c.primary}`,
          borderRadius: "var(--r-md)",
          padding: "10px 18px",
          color: c.ink,
        }
      : {}),
  };
  if (!code) {
    return <div style={wrapStyle}>{inner}</div>;
  }
  return (
    <Link
      href={`/team/${code}`}
      style={{ ...wrapStyle, textDecoration: "none", color: c ? c.ink : "inherit" }}
    >
      {inner}
    </Link>
  );
}

function MatchHero({
  match,
  accentTeams = false,
}: {
  match: Match;
  accentTeams?: boolean;
}) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <TeamChunk code={match.team_a_code} accentTeams={accentTeams} />
        {match.status === "live" || match.status === "final" ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="t-display tnum">{match.score_a ?? 0}</span>
            <span className="dim" style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>-</span>
            <span className="t-display tnum">{match.score_b ?? 0}</span>
          </div>
        ) : (
          <div className="t-display dim" style={{ fontSize: 36 }}>vs</div>
        )}
        <TeamChunk code={match.team_b_code} accentTeams={accentTeams} />
      </div>
      {match.status === "scheduled" ? (
        <>
          <div className="t-h1 tnum" style={{ marginTop: 18 }}>{countdownTo(match.kickoff_at)}</div>
          <div className="t-sub" style={{ marginTop: 6 }}>
            {dayLabel(match.kickoff_at)} · {timeOfDay(match.kickoff_at)}
          </div>
          {match.venue ? (
            <div className="t-small muted" style={{ marginTop: 2 }}>
              {match.venue}
            </div>
          ) : null}
        </>
      ) : match.status === "final" ? (
        <div className="t-small muted" style={{ marginTop: 14 }}>
          Final{match.venue ? ` · ${match.venue}` : ""}
        </div>
      ) : null}
    </div>
  );
}

function GroupPicksList({
  picks,
  match,
}: {
  picks: Awaited<ReturnType<typeof getPicksForUsersInMatch>>;
  match: Match;
}) {
  function pickLabel(p: "A" | "D" | "B") {
    if (p === "D") return { label: "Draw", flag: "•" };
    if (p === "A") return { label: match.team_a_code ?? "A", flag: flag(match.team_a_code) };
    return { label: match.team_b_code ?? "B", flag: flag(match.team_b_code) };
  }
  function statusOf(p: typeof picks[number]): "correct" | "wrong" | "hidden" | "open" {
    if (!p.pick) return "hidden";
    if (match.status !== "final" || !p.settled_at) return "open";
    const correct =
      (p.pick === "A" && match.winner_code === match.team_a_code) ||
      (p.pick === "B" && match.winner_code === match.team_b_code) ||
      (p.pick === "D" && match.winner_code === null);
    return correct ? "correct" : "wrong";
  }

  const inCount = picks.filter((p) => p.pick).length;

  return (
    <div>
      <div className="section-label">
        <span className="caps-label">Group picks</span>
        <span className="t-small muted">
          {inCount} of {picks.length} in
        </span>
      </div>
      <div className="card">
        {picks.map((p) => {
          const s = statusOf(p);
          const cls = s === "correct" ? "correct" : s === "wrong" ? "wrong" : s === "hidden" ? "hidden" : "";
          return (
            <div key={p.userId} className={`group-pick-row ${cls}`}>
              <div className="avatar sm">{p.displayName.slice(0, 1).toUpperCase()}</div>
              <div className="gp-name">{p.displayName}</div>
              {p.pick ? (
                <span className="gp-pick">
                  <span className="flag">{pickLabel(p.pick).flag}</span> {pickLabel(p.pick).label}
                </span>
              ) : (
                <span className="gp-pick">Pending</span>
              )}
              <span className={`gp-stake tnum ${p.pick ? "" : "dim"}`}>
                {p.pick
                  ? match.status === "final" && p.settled_at
                    ? p.payout_wcp > 0
                      ? `+${p.payout_wcp}`
                      : p.stake > 0
                        ? `-${p.stake}`
                        : "0"
                    : p.stake
                  : "-"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PostMatchSummary({
  match,
  myPick,
}: {
  match: Match;
  myPick: Awaited<ReturnType<typeof getPicksForUsersInMatch>>[number] | undefined;
}) {
  if (!myPick || !myPick.pick) {
    return (
      <div className="card empty-block" style={{ textAlign: "center" }}>
        <div className="empty-lead">You missed this one.</div>
        <div className="empty-sub" style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
          No pick locked - no <WcpIcon size={14} /> WCP earned.
        </div>
      </div>
    );
  }
  const correct =
    (myPick.pick === "A" && match.winner_code === match.team_a_code) ||
    (myPick.pick === "B" && match.winner_code === match.team_b_code) ||
    (myPick.pick === "D" && match.winner_code === null);

  const winnerLabel =
    match.winner_code === match.team_a_code
      ? `${flag(match.team_a_code)} ${match.team_a_code}`
      : match.winner_code === match.team_b_code
        ? `${flag(match.team_b_code)} ${match.team_b_code}`
        : "Draw";

  return (
    <div
      className="card elevated"
      style={{ borderColor: correct ? "var(--pitch)" : "var(--penalty)", borderWidth: 2, borderStyle: "solid" }}
    >
      <div className="section-label" style={{ marginBottom: 8 }}>
        <span className="caps-label">Your pick · {correct ? "Correct" : "Wrong"}</span>
        <span style={{ fontSize: 18 }}>{correct ? "✓" : "✗"}</span>
      </div>
      <div className="t-small muted">Winner</div>
      <div className="t-h2" style={{ marginBottom: 8 }}>{winnerLabel}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div className="t-small muted">Your pick</div>
          <div className="t-h2">
            {myPick.pick === "D"
              ? "Draw"
              : myPick.pick === "A"
                ? `${flag(match.team_a_code)} ${match.team_a_code}`
                : `${flag(match.team_b_code)} ${match.team_b_code}`}
            {myPick.stake > 0 ? ` · ${myPick.stake} staked` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="t-small muted">Payout</div>
          <div
            className="t-display tnum"
            style={{ fontSize: 32, color: correct ? "var(--pitch)" : "var(--penalty)", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {correct ? (
              <>+{myPick.payout_wcp} <WcpIcon size={22} /></>
            ) : myPick.stake > 0 ? (
              <>-{myPick.stake} <WccIcon size={22} /></>
            ) : (
              "0"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchDrinksBars({ counts, members }: { counts: Map<string, number>; members: { userId: string; displayName: string; flag: string }[] }) {
  const max = Math.max(1, ...Array.from(counts.values()));
  const sorted = members
    .map((m) => ({ ...m, c: counts.get(m.userId) ?? 0 }))
    .sort((a, b) => b.c - a.c);
  const total = sorted.reduce((s, x) => s + x.c, 0);
  return (
    <div>
      <div className="section-label">
        <span className="caps-label">Match drinks</span>
        <span className="t-small muted">{total} total</span>
      </div>
      <div className="card">
        {sorted.map((m) => (
          <div key={m.userId} className="drink-row">
            <span className="flag">{m.flag || "·"}</span>
            <span className="who">{m.displayName}</span>
            <span className="bar-wrap">
              {m.c > 0 ? <span className="bar" style={{ width: `${Math.round((m.c / max) * 100)}%` }} /> : null}
            </span>
            <span className="count">{m.c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isFinite(matchId)) notFound();

  const [match, member] = await Promise.all([
    getMatchById(matchId),
    getCurrentMembership(),
  ]);
  if (!match || !member) notFound();

  // Branch by status.
  if (match.status === "live") {
    return <LiveView match={match} userId={member.userId} />;
  }
  if (match.status === "final") {
    return <PostView match={match} userId={member.userId} />;
  }
  // scheduled / postponed
  return <PreView match={match} userId={member.userId} />;
}

async function LiveView({
  match,
  userId,
}: {
  match: Match;
  userId: string;
}) {
  const teamCodes = [match.team_a_code, match.team_b_code].filter(
    (c): c is string => !!c,
  );
  const crossBracketMembers = await getCrossBracketMembers(userId);
  const memberInput = crossBracketMembers.map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    role: m.role,
  }));
  const memberIds = crossBracketMembers.map((m) => m.userId);
  const [stats, picks, drinkCounts, watching, stampedBeers, beerCounts] = await Promise.all([
    getMemberStats("", userId),
    getPicksForUsersInMatch(memberInput, match.id),
    getDrinksForUsersInMatch(memberIds, match.id),
    getWatchingForUsersInMatch(memberIds, match.id),
    getUserStampedBeers(userId),
    getUserBeerCountsForMatch(userId, match.id, teamCodes),
  ]);

  const myPick = picks.find((p) => p.userId === userId);
  const myDrinks = Number(drinkCounts.get(userId) ?? 0);
  const myBeerCountThisMatch = Number(
    Array.from(beerCounts.values()).reduce((a, b) => Number(a) + Number(b), 0),
  );
  const myBasicCountThisMatch = Math.max(
    0,
    (Number.isFinite(myDrinks) ? myDrinks : 0) -
      (Number.isFinite(myBeerCountThisMatch) ? myBeerCountThisMatch : 0),
  );

  const beersA = match.team_a_code ? COUNTRY_BEERS[match.team_a_code] ?? [] : [];
  const beersB = match.team_b_code ? COUNTRY_BEERS[match.team_b_code] ?? [] : [];

  const pickedCode =
    myPick?.pick === "A"
      ? match.team_a_code
      : myPick?.pick === "B"
        ? match.team_b_code
        : null;
  const accent = colorFor(pickedCode);

  const members: WatchingMember[] = picks.map((p) => ({
    userId: p.userId,
    displayName: p.userId === userId ? "You" : p.displayName,
    flag:
      p.pick === "A"
        ? flag(match.team_a_code)
        : p.pick === "B"
          ? flag(match.team_b_code)
          : "",
    drinkCount: drinkCounts.get(p.userId) ?? 0,
    watching: watching.has(p.userId),
    isYou: p.userId === userId,
  }));

  return (
    <>
      <MatchAppbar match={match} />
      <div className="screen" style={{ paddingBottom: 92, gap: 16 }}>
        <MatchHero match={match} accentTeams />

        {/* Your pick row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: pickedCode ? accent.tint : "var(--paper)",
            borderRadius: "var(--r-md)",
            borderLeft: pickedCode ? `4px solid ${accent.primary}` : undefined,
            color: accent.ink,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="caps-label">Your pick</span>
            {myPick?.pick ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="flag">
                  {myPick.pick === "A"
                    ? flag(match.team_a_code)
                    : myPick.pick === "B"
                      ? flag(match.team_b_code)
                      : "•"}
                </span>
                <span className="t-sub">
                  {myPick.pick === "A" ? match.team_a_code : myPick.pick === "B" ? match.team_b_code : "Draw"}
                </span>
              </span>
            ) : (
              <span className="t-small muted">no pick</span>
            )}
          </div>
          {myPick?.stake ? (
            <span className="badge stake tnum" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <WccIcon size={12} /> {myPick.stake} staked
            </span>
          ) : null}
        </div>

        <PourButton
          matchId={match.id}
          initialBasicCount={myBasicCountThisMatch}
          countryCount={myBeerCountThisMatch}
          totalAllTime={stats.drinks}
        />

        {match.team_a_code ? (
          <BeerStampRail
            matchId={match.id}
            countryCode={match.team_a_code}
            countryName={countryName(match.team_a_code)}
            flag={flag(match.team_a_code)}
            beers={beersA}
            claimedNames={stampedBeers}
            matchCounts={beerCounts}
          />
        ) : null}

        {match.team_b_code ? (
          <BeerStampRail
            matchId={match.id}
            countryCode={match.team_b_code}
            countryName={countryName(match.team_b_code)}
            flag={flag(match.team_b_code)}
            beers={beersB}
            claimedNames={stampedBeers}
            matchCounts={beerCounts}
          />
        ) : null}

        <WatchingNow matchId={match.id} userIds={memberIds} initialMembers={members} />

        <div style={{ height: 8 }} />
      </div>
    </>
  );
}

async function PreView({
  match,
  userId,
}: {
  match: Match;
  userId: string;
}) {
  const crossBracketMembers = await getCrossBracketMembers(userId);
  const memberInput = crossBracketMembers.map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    role: m.role,
  }));
  const [stats, picks] = await Promise.all([
    getMemberStats("", userId),
    getPicksForUsersInMatch(memberInput, match.id),
  ]);
  const my = picks.find((p) => p.userId === userId);
  const isKnockout = match.stage !== "group";

  return (
    <>
      <MatchAppbar match={match} />
      <div className="screen" style={{ gap: 18 }}>
        <PreMatchInteractive
          matchId={match.id}
          isKnockout={isKnockout}
          teamACode={match.team_a_code}
          teamBCode={match.team_b_code}
          flagA={flag(match.team_a_code)}
          flagB={flag(match.team_b_code)}
          availableWcc={stats.wcc}
          initial={my?.pick ? { pick: my.pick, stake: my.stake } : null}
          locksAt={match.kickoff_at}
          hero={<MatchHero match={match} />}
          groupPicks={<GroupPicksList picks={picks} match={match} />}
        />
        <div style={{ height: 16 }} />
      </div>
    </>
  );
}

async function PostView({
  match,
  userId,
}: {
  match: Match;
  userId: string;
}) {
  const crossBracketMembers = await getCrossBracketMembers(userId);
  const memberInput = crossBracketMembers.map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    role: m.role,
  }));
  const memberIds = crossBracketMembers.map((m) => m.userId);
  const [picks, drinkCounts] = await Promise.all([
    getPicksForUsersInMatch(memberInput, match.id),
    getDrinksForUsersInMatch(memberIds, match.id),
  ]);
  const my = picks.find((p) => p.userId === userId);
  const memberList = picks.map((p) => ({
    userId: p.userId,
    displayName: p.userId === userId ? "You" : p.displayName,
    flag:
      p.pick === "A"
        ? flag(match.team_a_code)
        : p.pick === "B"
          ? flag(match.team_b_code)
          : "",
  }));

  return (
    <>
      <MatchAppbar match={match} />
      <div className="screen" style={{ gap: 18 }}>
        <MatchHero match={match} />
        <PostMatchSummary match={match} myPick={my} />
        <GroupPicksList picks={picks} match={match} />
        <MatchDrinksBars counts={drinkCounts} members={memberList} />
        <div style={{ height: 16 }} />
      </div>
    </>
  );
}

// Tiny country-code → display name. Falls back to the code.
function countryName(code: string): string {
  const NAMES: Record<string, string> = {
    MEX: "Mexico", RSA: "South Africa", KOR: "South Korea", CZE: "Czechia",
    CAN: "Canada", BIH: "Bosnia", QAT: "Qatar", SUI: "Switzerland",
    BRA: "Brazil", HAI: "Haiti", MAR: "Morocco", SCO: "Scotland",
    AUS: "Australia", PAR: "Paraguay", TUR: "Turkey", USA: "USA",
    CIV: "Ivory Coast", CUW: "Curaçao", ECU: "Ecuador", GER: "Germany",
    JPN: "Japan", NED: "Netherlands", SWE: "Sweden", TUN: "Tunisia",
    BEL: "Belgium", EGY: "Egypt", IRN: "Iran", NZL: "New Zealand",
    CPV: "Cape Verde", ESP: "Spain", KSA: "Saudi Arabia", URY: "Uruguay",
    FRA: "France", IRQ: "Iraq", NOR: "Norway", SEN: "Senegal",
    ALG: "Algeria", ARG: "Argentina", AUT: "Austria", JOR: "Jordan",
    COD: "Congo DR", COL: "Colombia", POR: "Portugal", UZB: "Uzbekistan",
    CRO: "Croatia", ENG: "England", GHA: "Ghana", PAN: "Panama",
  };
  return NAMES[code] ?? code;
}
