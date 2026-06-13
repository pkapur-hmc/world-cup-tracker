import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchById, matchPhase, type Match } from "@/lib/fixtures";
import { BackButton } from "@/components/ui/BackButton";
import { getCurrentMembership, getCrossBracketMembers } from "@/lib/membership";
import { getMemberStats } from "@/lib/stats";
import {
  getPicksForUsersInMatch,
  getMatchEarningsForUsers,
  getWatchingForUsersInMatch,
  getUserStampedBeers,
  getUserBeerCountsForMatch,
  getUserGenericCountryCounts,
} from "@/lib/picks";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { COUNTRY_BEERS } from "@/data/country-beers";
import { colorFor } from "@/data/country-colors";
import { PourButton } from "./PourButton";
import { BeerStampRail } from "./BeerStampRail";
import { WatchingNow, type WatchingMember } from "./WatchingNow";
import { PeoplePanelTabs } from "./PeoplePanelTabs";
import { PickAndStake } from "./PickAndStake";
import { GuardedMatchAppbar, UnsavedPickProvider } from "./UnsavedPickGuard";
import { PickPanel } from "@/components/ui/PickPanel";
import { LocalTime } from "@/components/ui/LocalTime";
import { WccIcon } from "@/components/ui/CurrencyIcon";

function flag(code: string | null) {
  return code ? FLAG_EMOJI[code] ?? "" : "";
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
      {matchPhase(match) === "live" ? (
        <span className="badge live">
          <span className="dot" />
          Live
        </span>
      ) : null}
    </div>
  );
}

/**
 * One horizontal scoreboard line per side: code + flag for the home side,
 * flag + code for the away side, flags hugging the score. Everything in the
 * hero's main row shares a single vertical center, so nothing can float.
 * The pick reads through a bold code + dimmed opponent; the "your pick"
 * badge renders on its own row below (see MatchHero).
 */
function TeamChunk({
  code,
  side,
  picked = false,
  dimmed = false,
}: {
  code: string | null;
  side: "a" | "b";
  picked?: boolean;
  dimmed?: boolean;
}) {
  const c = picked && code ? colorFor(code) : null;
  const flagEl = <span className="flag xl">{flag(code)}</span>;
  const codeEl = (
    <span className="t-sub" style={picked ? { fontWeight: 800 } : undefined}>
      {code ?? "TBD"}
    </span>
  );
  const inner =
    side === "a" ? (
      <>
        {codeEl}
        {flagEl}
      </>
    ) : (
      <>
        {flagEl}
        {codeEl}
      </>
    );
  const wrapStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    opacity: dimmed ? 0.5 : 1,
    transition: "opacity 150ms ease",
    ...(c ? { color: c.ink } : {}),
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

function PickBadge({ code }: { code: string | null }) {
  if (!code) return null;
  const c = colorFor(code);
  return (
    <span
      className="badge"
      style={{
        background: c.primary,
        color: readableInk(c.primary),
        fontSize: 9,
        padding: "2px 8px",
      }}
    >
      ✓ Your pick
    </span>
  );
}

function MatchHero({
  match,
  pickedSide = null,
}: {
  match: Match;
  pickedSide?: "A" | "D" | "B" | null;
}) {
  const aPicked = pickedSide === "A";
  const bPicked = pickedSide === "B";
  const drawPicked = pickedSide === "D";
  const hasTeamPick = aPicked || bPicked;
  const teamAColor = match.team_a_code ? colorFor(match.team_a_code) : null;
  const teamBColor = match.team_b_code ? colorFor(match.team_b_code) : null;
  const phase = matchPhase(match);
  return (
    <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
      {/* Single scoreboard line: KOR 🇰🇷  2 - 1  🇨🇿 CZE. 1fr auto 1fr keeps
          the score dead-center; one row, one vertical center, so flags, codes
          and score always sit level. The picked side's badge lives on its own
          grid row below and can't push anything off that line. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          columnGap: 14,
          rowGap: 8,
        }}
      >
        <div style={{ justifySelf: "end", minWidth: 0 }}>
          <TeamChunk
            code={match.team_a_code}
            side="a"
            picked={aPicked}
            dimmed={hasTeamPick && !aPicked}
          />
        </div>
        <div style={{ justifySelf: "center" }}>
        {phase === "live" || match.status === "final" ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="t-display tnum">{match.score_a ?? 0}</span>
            <span className="dim" style={{ fontFamily: "var(--ff-display)", fontSize: 24 }}>-</span>
            <span className="t-display tnum">{match.score_b ?? 0}</span>
          </div>
        ) : drawPicked ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "12px 18px",
              borderRadius: "var(--r-md)",
              border: "2px solid var(--stout)",
              background:
                teamAColor && teamBColor
                  ? `linear-gradient(90deg, ${teamAColor.tint} 0%, ${teamAColor.tint} 50%, ${teamBColor.tint} 50%, ${teamBColor.tint} 100%)`
                  : "var(--paper)",
              boxShadow: "0 4px 14px -6px rgba(40,22,4,0.25)",
              color: "var(--stout)",
            }}
          >
            <span
              className="t-display"
              style={{ fontSize: 26, lineHeight: 1, fontWeight: 800 }}
            >
              vs
            </span>
            <span
              className="badge"
              style={{
                background: "var(--stout)",
                color: "var(--foam-lit)",
                fontSize: 9,
                padding: "2px 8px",
                marginTop: 2,
                letterSpacing: "0.04em",
              }}
            >
              ✓ Your pick · Draw
            </span>
          </div>
        ) : (
          <div className="t-display dim" style={{ fontSize: 36 }}>vs</div>
        )}
        </div>
        <div style={{ justifySelf: "start", minWidth: 0 }}>
          <TeamChunk
            code={match.team_b_code}
            side="b"
            picked={bPicked}
            dimmed={hasTeamPick && !bPicked}
          />
        </div>
        {hasTeamPick ? (
          <>
            <div style={{ gridColumn: 1, gridRow: 2, justifySelf: "end" }}>
              {aPicked ? <PickBadge code={match.team_a_code} /> : null}
            </div>
            <div style={{ gridColumn: 3, gridRow: 2, justifySelf: "start" }}>
              {bPicked ? <PickBadge code={match.team_b_code} /> : null}
            </div>
          </>
        ) : null}
      </div>
      {phase === "pre" && match.status === "scheduled" ? (
        <>
          <div className="t-h1 tnum" style={{ marginTop: 18 }}>{countdownTo(match.kickoff_at)}</div>
          <div className="t-sub" style={{ marginTop: 6 }}>
            <LocalTime iso={match.kickoff_at} mode="dayLong" /> · <LocalTime iso={match.kickoff_at} mode="time" />
          </div>
        </>
      ) : match.status === "final" ? (
        <div className="t-small muted" style={{ marginTop: 14 }}>Final</div>
      ) : null}
      {match.venue ? (
        <div
          className="t-small muted"
          style={{ marginTop: phase === "pre" ? 2 : 6 }}
        >
          {match.venue}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Picks grouped BY BET, not by person: one section per side (team A, draw,
 * team B - empty sides skipped) with a flag + count header and the backers'
 * names wrapped below, biggest stake first. Post-match the winning section
 * gets a ✓ and winners show their payout; losing sections dim. Non-bettors
 * collapse to one muted footer line - present for the call-out, but they
 * don't get a section.
 */
function GroupPicksList({
  picks,
  match,
}: {
  picks: Awaited<ReturnType<typeof getPicksForUsersInMatch>>;
  match: Match;
}) {
  const inCount = picks.filter((p) => p.pick).length;
  const isFinal = match.status === "final";
  const winnerSide: "A" | "D" | "B" | null = !isFinal
    ? null
    : match.winner_code === match.team_a_code
      ? "A"
      : match.winner_code === match.team_b_code
        ? "B"
        : "D";

  const sides: {
    key: "A" | "D" | "B";
    flag: string;
    label: string;
    ink: string | null;
    backers: typeof picks;
  }[] = [
    {
      key: "A" as const,
      flag: flag(match.team_a_code),
      label: match.team_a_code ?? "A",
      ink: match.team_a_code ? colorFor(match.team_a_code).ink : null,
    },
    { key: "D" as const, flag: "🤝", label: "Draw", ink: null },
    {
      key: "B" as const,
      flag: flag(match.team_b_code),
      label: match.team_b_code ?? "B",
      ink: match.team_b_code ? colorFor(match.team_b_code).ink : null,
    },
  ]
    .map((s) => ({
      ...s,
      backers: picks
        .filter((p) => p.pick === s.key)
        .sort((a, b) => b.stake - a.stake || a.displayName.localeCompare(b.displayName)),
    }))
    .filter((s) => s.backers.length > 0);

  const noBet = picks.filter((p) => !p.pick);

  return (
    <div>
      <div className="section-label">
        <span className="caps-label">Group picks</span>
        <span className="t-small muted">
          {inCount} of {picks.length} in
        </span>
      </div>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sides.length === 0 ? (
          <div className="t-small muted" style={{ textAlign: "center", padding: "6px 0" }}>
            No bets yet.
          </div>
        ) : (
          sides.map((s) => {
            const won = winnerSide === s.key;
            const lost = winnerSide !== null && !won;
            return (
              <div key={s.key} style={{ opacity: lost ? 0.5 : 1 }}>
                <div
                  className="caps-label"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: s.ink ?? undefined,
                  }}
                >
                  <span className="flag">{s.flag}</span>
                  <span>{s.label}</span>
                  <span className="muted" style={{ fontWeight: 600 }}>· {s.backers.length}</span>
                  {won ? <span style={{ color: "var(--pitch)" }}>✓</span> : null}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {s.backers.map((p) => {
                    const settled = isFinal && p.settled_at;
                    const suffix = settled
                      ? p.payout_wcp > 0
                        ? `+${p.payout_wcp}`
                        : p.stake > 0
                          ? `-${p.stake}`
                          : null
                      : p.stake > 0
                        ? `·${p.stake}`
                        : null;
                    return (
                      <span
                        key={p.userId}
                        className="t-small"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 9px",
                          borderRadius: "var(--r-pill)",
                          border: "1px solid var(--stout-12)",
                          background: "var(--paper)",
                        }}
                      >
                        {p.displayName}
                        {suffix ? (
                          <span
                            className="tnum"
                            style={{
                              fontWeight: 700,
                              color: settled
                                ? p.payout_wcp > 0
                                  ? "var(--pitch)"
                                  : "var(--penalty)"
                                : "var(--stout-55)",
                            }}
                          >
                            {suffix}
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
        {noBet.length > 0 ? (
          <div
            className="t-small muted"
            style={{
              borderTop: "1px solid var(--stout-12)",
              paddingTop: 10,
            }}
          >
            No bet · {noBet.map((p) => p.displayName).join(", ")}
          </div>
        ) : null}
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
          No pick locked - no <WccIcon size={14} /> WCC won.
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
              <>+{myPick.payout_wcp} <WccIcon size={22} /></>
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

/** Post-match earnings bars, ranked and sized by WCC earned (country beer = 2,
 *  basic = 1) - the same ordering the live panel uses, so the room reads the
 *  same during and after the match. */
function MatchDrinksBars({
  earnings,
  members,
}: {
  earnings: Map<string, { drinks: number; wcc: number }>;
  members: { userId: string; displayName: string; flag: string }[];
}) {
  const max = Math.max(1, ...Array.from(earnings.values()).map((e) => e.wcc));
  const sorted = members
    .map((m) => ({ ...m, wcc: earnings.get(m.userId)?.wcc ?? 0 }))
    .sort((a, b) => b.wcc - a.wcc);
  const total = sorted.reduce((s, x) => s + x.wcc, 0);
  return (
    <div>
      <div className="section-label">
        <span className="caps-label">WCC this match</span>
        <span className="t-small muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <WccIcon size={12} /> {total} total
        </span>
      </div>
      <div className="card">
        {sorted.map((m) => (
          <div key={m.userId} className="drink-row">
            <span className="flag">{m.flag || "·"}</span>
            <span className="who">{m.displayName}</span>
            <span className="bar-wrap">
              {m.wcc > 0 ? <span className="bar" style={{ width: `${Math.round((m.wcc / max) * 100)}%` }} /> : null}
            </span>
            <span className="count" style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              <WccIcon size={14} />
              {m.wcc}
            </span>
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

  // Branch by phase (time-driven, not the feed's status flag - see matchPhase).
  const phase = matchPhase(match);
  if (phase === "live") {
    return <LiveView match={match} userId={member.userId} />;
  }
  if (phase === "post") {
    return <PostView match={match} userId={member.userId} />;
  }
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
  const [stats, picks, earnings, watching, stampedBeers, beerCounts, genericCounts] = await Promise.all([
    getMemberStats("", userId),
    getPicksForUsersInMatch(memberInput, match.id),
    getMatchEarningsForUsers(memberIds, match.id),
    getWatchingForUsersInMatch(memberIds, match.id),
    getUserStampedBeers(userId),
    getUserBeerCountsForMatch(userId, match.id, teamCodes),
    getUserGenericCountryCounts(userId, match.id, teamCodes),
  ]);

  const myPick = picks.find((p) => p.userId === userId);
  const myDrinks = Number(earnings.get(userId)?.drinks ?? 0);
  // "Country" = stampable beers logged + generic country beers (both +2 WCC);
  // basic is whatever's left. Generic beers don't earn stamps but still count
  // as country beers for the WCC breakdown.
  const myStampBeerCount = Array.from(beerCounts.values()).reduce((a, b) => Number(a) + Number(b), 0);
  const myGenericCount = Array.from(genericCounts.values()).reduce((a, b) => Number(a) + Number(b), 0);
  const myBeerCountThisMatch = Number(myStampBeerCount) + Number(myGenericCount);
  const myBasicCountThisMatch = Math.max(
    0,
    (Number.isFinite(myDrinks) ? myDrinks : 0) -
      (Number.isFinite(myBeerCountThisMatch) ? myBeerCountThisMatch : 0),
  );

  const beersA = match.team_a_code ? COUNTRY_BEERS[match.team_a_code] ?? [] : [];
  const beersB = match.team_b_code ? COUNTRY_BEERS[match.team_b_code] ?? [] : [];

  // Pass every bracket-mate; WatchingNow renders whoever has earned WCC on
  // this match (plus you) and keeps polling the full set, so a new earner
  // appears mid-match without a reload.
  const members: WatchingMember[] = picks.map((p) => ({
    userId: p.userId,
    displayName: p.userId === userId ? "You" : p.displayName,
    // Draw pick gets its own mark so it doesn't read as "no pick" in the row.
    flag:
      p.pick === "A"
        ? flag(match.team_a_code)
        : p.pick === "B"
          ? flag(match.team_b_code)
          : p.pick === "D"
            ? "🤝"
            : "",
    drinkCount: earnings.get(p.userId)?.drinks ?? 0,
    wcc: earnings.get(p.userId)?.wcc ?? 0,
    watching: watching.has(p.userId),
    isYou: p.userId === userId,
  }));

  // The live hero wears the picked country's colors, exactly like a picked
  // pre-match hero - so the pick stays front and center once it's locked.
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
  const heroWrapStyle: React.CSSProperties = {
    borderRadius: "var(--r-lg)",
    padding: "6px 14px 10px",
  };
  if (pickedCode) {
    heroWrapStyle.borderLeft = `4px solid ${accent.primary}`;
    heroWrapStyle.background = accent.tint;
  } else if (drawPicked && teamAColor && teamBColor) {
    heroWrapStyle.borderLeft = `4px solid ${teamAColor.primary}`;
    heroWrapStyle.borderRight = `4px solid ${teamBColor.primary}`;
    heroWrapStyle.background = `linear-gradient(90deg, ${teamAColor.tint} 0%, ${teamBColor.tint} 100%)`;
  } else {
    heroWrapStyle.borderLeft = "4px solid transparent";
  }

  return (
    <>
      <MatchAppbar match={match} />
      <div className="screen" style={{ paddingBottom: 92, gap: 16 }}>
        <div style={heroWrapStyle}>
          <MatchHero match={match} pickedSide={myPick?.pick ?? null} />
        </div>

        {myPick?.pick ? (
          <PickPanel
            teamACode={match.team_a_code}
            teamBCode={match.team_b_code}
            pick={myPick.pick}
            stake={myPick.stake}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "var(--paper)",
              border: "1px solid var(--stout-12)",
              borderRadius: "var(--r-md)",
            }}
          >
            <span className="caps-label">Your pick</span>
            <span className="t-small muted">no pick locked</span>
          </div>
        )}

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
            claimedNames={stampedBeers.get(match.team_a_code) ?? new Set()}
            matchCounts={beerCounts}
            initialGenericCount={genericCounts.get(match.team_a_code) ?? 0}
          />
        ) : null}

        {match.team_b_code ? (
          <BeerStampRail
            matchId={match.id}
            countryCode={match.team_b_code}
            countryName={countryName(match.team_b_code)}
            flag={flag(match.team_b_code)}
            beers={beersB}
            claimedNames={stampedBeers.get(match.team_b_code) ?? new Set()}
            matchCounts={beerCounts}
            initialGenericCount={genericCounts.get(match.team_b_code) ?? 0}
          />
        ) : null}

        <PeoplePanelTabs
          tabs={[
            {
              key: "pours",
              label: "🍺 Pours",
              content: (
                <WatchingNow
                  matchId={match.id}
                  userIds={memberIds}
                  initialMembers={members}
                />
              ),
            },
            {
              key: "picks",
              label: "🎯 Picks",
              content: <GroupPicksList picks={picks} match={match} />,
            },
          ]}
        />

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

  // Hero takes on the picked country's colors, but only once the pick is
  // locked (server-confirmed) - not while the user is still tapping sides.
  // Draw state: blend both teams' tints so the panel still reads as "picked"
  // with equal weight to each side.
  const pickedCode =
    my?.pick === "A"
      ? match.team_a_code
      : my?.pick === "B"
        ? match.team_b_code
        : null;
  const accent = colorFor(pickedCode);
  const drawPicked = my?.pick === "D";
  const teamAColor = match.team_a_code ? colorFor(match.team_a_code) : null;
  const teamBColor = match.team_b_code ? colorFor(match.team_b_code) : null;

  const heroWrapStyle: React.CSSProperties = {
    borderRadius: "var(--r-lg)",
    padding: "6px 14px 10px",
  };
  if (pickedCode) {
    heroWrapStyle.borderLeft = `4px solid ${accent.primary}`;
    heroWrapStyle.background = accent.tint;
  } else if (drawPicked && teamAColor && teamBColor) {
    heroWrapStyle.borderLeft = `4px solid ${teamAColor.primary}`;
    heroWrapStyle.borderRight = `4px solid ${teamBColor.primary}`;
    heroWrapStyle.background = `linear-gradient(90deg, ${teamAColor.tint} 0%, ${teamBColor.tint} 100%)`;
  } else {
    heroWrapStyle.borderLeft = "4px solid transparent";
  }

  return (
    <UnsavedPickProvider>
      <GuardedMatchAppbar match={match} />
      <div className="screen" style={{ gap: 18 }}>
        <div style={heroWrapStyle}>
          <MatchHero match={match} pickedSide={my?.pick ?? null} />
        </div>

        {match.team_a_code && match.team_b_code ? (
          <PickAndStake
            matchId={match.id}
            isKnockout={isKnockout}
            teamACode={match.team_a_code}
            teamBCode={match.team_b_code}
            flagA={flag(match.team_a_code)}
            flagB={flag(match.team_b_code)}
            availableWcc={stats.wcc}
            initial={my?.pick ? { pick: my.pick, stake: my.stake } : null}
            locksAt={match.kickoff_at}
          />
        ) : (
          <div className="card empty-block" style={{ textAlign: "center" }}>
            <div className="empty-lead">Not your turn yet.</div>
            <div className="empty-sub">Knockout picks open after group stage wraps.</div>
          </div>
        )}

        <GroupPicksList picks={picks} match={match} />
        <div style={{ height: 16 }} />
      </div>
    </UnsavedPickProvider>
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
  const [picks, earnings] = await Promise.all([
    getPicksForUsersInMatch(memberInput, match.id),
    getMatchEarningsForUsers(memberIds, match.id),
  ]);
  const my = picks.find((p) => p.userId === userId);
  const memberList = picks.map((p) => ({
    userId: p.userId,
    displayName: p.userId === userId ? "You" : p.displayName,
    // Draw pick gets its own mark so it doesn't read as "no pick" in the row.
    flag:
      p.pick === "A"
        ? flag(match.team_a_code)
        : p.pick === "B"
          ? flag(match.team_b_code)
          : p.pick === "D"
            ? "🤝"
            : "",
  }));

  return (
    <>
      <MatchAppbar match={match} />
      <div className="screen" style={{ gap: 18 }}>
        <MatchHero match={match} />
        <PostMatchSummary match={match} myPick={my} />
        <GroupPicksList picks={picks} match={match} />
        <MatchDrinksBars earnings={earnings} members={memberList} />
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

// Dark or light foreground that reads on a #rrggbb fill (luma check).
function readableInk(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#1C140C";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.55 ? "#1C140C" : "#FFFEF2";
}
