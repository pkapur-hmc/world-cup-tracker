import Link from "next/link";
import Image from "next/image";
import { getAllMemberships, getCurrentMembership, getCrossBracketMembers } from "@/lib/membership";
import { BracketStandings } from "./BracketStandings";
import { getLiveMatches, getNextMatch, type Match } from "@/lib/fixtures";
import { getMemberStats } from "@/lib/stats";
import { getPicksForUsersInMatch } from "@/lib/picks";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { colorFor } from "@/data/country-colors";
import { WccIcon } from "@/components/ui/CurrencyIcon";
import { InfoChip } from "@/components/ui/InfoChip";
import { PickPanel } from "@/components/ui/PickPanel";
import { LocalTime } from "@/components/ui/LocalTime";
import { HomeInviteCard } from "./HomeInviteCard";

type MyPick = { pick: "A" | "D" | "B"; stake: number } | null;

function flag(code: string | null) {
  if (!code) return "";
  return FLAG_EMOJI[code] ?? "";
}

function tlaShort(code: string | null) {
  return code ?? "TBD";
}

function countdownTo(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "now";
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `in ${d}d ${h % 24}h`;
  }
  if (h > 0) return `in ${h}h ${String(m).padStart(2, "0")}m`;
  return `in ${m}m`;
}

function LiveBlock({ match, watching }: { match: Match; watching: number }) {
  return (
    <>
      <div className="section-label">
        <span className="caps-label">Live now</span>
        <span className="badge live">
          <span className="dot" />
          Live
        </span>
      </div>
      <Link
        href={`/match/${match.id}`}
        className="card elevated"
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="flag lg">{flag(match.team_a_code)}</span>
            <span className="t-h1 tnum">{match.score_a ?? 0}</span>
            <span className="dim" style={{ fontFamily: "var(--ff-display)", fontSize: 22 }}>
              -
            </span>
            <span className="t-h1 tnum">{match.score_b ?? 0}</span>
            <span className="flag lg">{flag(match.team_b_code)}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="t-h2 tnum">
              live
            </div>
            <div className="caps-label">in play</div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--stout-12)",
          }}
        >
          <div className="t-small muted">
            {match.group_letter ? `Group ${match.group_letter}` : match.stage.toUpperCase()} ·{" "}
            {watching} watching
          </div>
          <div className="t-small" style={{ color: "var(--burn)", fontWeight: 700 }}>
            Open match →
          </div>
        </div>
      </Link>
    </>
  );
}

function NextBlock({ match, myPick }: { match: Match; myPick: MyPick }) {
  const pickedCode =
    myPick?.pick === "A"
      ? match.team_a_code
      : myPick?.pick === "B"
        ? match.team_b_code
        : null;
  const accent = colorFor(pickedCode);

  return (
    <>
      <div className="section-label" style={{ marginTop: 8 }}>
        <span className="caps-label">Next up</span>
        <span className="t-small muted tnum">{countdownTo(match.kickoff_at)}</span>
      </div>
      <div
        className="card"
        style={
          pickedCode
            ? {
                borderLeft: `4px solid ${accent.primary}`,
                background: accent.tint,
              }
            : undefined
        }
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="flag">{flag(match.team_a_code)}</span>
              <span className="t-sub">{tlaShort(match.team_a_code)}</span>
              <span className="dim">vs</span>
              <span className="flag">{flag(match.team_b_code)}</span>
              <span className="t-sub">{tlaShort(match.team_b_code)}</span>
            </div>
            <div className="t-small muted" style={{ marginTop: 4 }}>
              {match.group_letter ? `Group ${match.group_letter}` : match.stage.toUpperCase()}{" "}
              {match.venue ? `· ${match.venue}` : ""}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="t-h2 tnum"><LocalTime iso={match.kickoff_at} mode="time" /></div>
            <div className="t-small muted"><LocalTime iso={match.kickoff_at} mode="dayShort" /></div>
          </div>
        </div>

        {myPick ? (
          <PickPanel
            teamACode={match.team_a_code}
            teamBCode={match.team_b_code}
            pick={myPick.pick}
            stake={myPick.stake}
            style={{ marginTop: 12 }}
          />
        ) : null}

        <Link
          href={`/match/${match.id}`}
          className={`btn ${myPick ? "secondary" : "primary"} block`}
          style={{ marginTop: 12, textDecoration: "none" }}
        >
          {myPick ? "Edit pick" : "Make your pick"}
        </Link>
      </div>
    </>
  );
}

function EmptyDay() {
  return (
    <div className="card empty-block" style={{ textAlign: "center" }}>
      <div className="empty-lead">Quiet day.</div>
      <div className="empty-sub">No matches in progress.</div>
    </div>
  );
}

export default async function HomePage() {
  const member = await getCurrentMembership();
  if (!member) return null; // layout already handled redirects
  const allMemberships = await getAllMemberships();
  const inMultiple = allMemberships.length > 1;
  const soloBracket = inMultiple ? null : allMemberships[0] ?? null;

  const [liveMatches, nextMatch, stats, crossBracketMembers] = await Promise.all([
    getLiveMatches(),
    getNextMatch(),
    getMemberStats("", member.userId),
    getCrossBracketMembers(member.userId),
  ]);

  let nextMyPick: MyPick = null;
  if (nextMatch) {
    const picks = await getPicksForUsersInMatch(
      crossBracketMembers.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        role: m.role,
      })),
      nextMatch.id,
    );
    const mine = picks.find((p) => p.userId === member.userId);
    if (mine?.pick) nextMyPick = { pick: mine.pick, stake: mine.stake };
  }

  return (
    <>
      <div className="appbar">
        <Image className="mark" src="/mark.svg" alt="" width={36} height={36} />
        <div>
          <div className="group-name">
            {soloBracket ? soloBracket.groupName : "The World Cup Cup"}
          </div>
          <div className="group-meta">
            {soloBracket
              ? `${soloBracket.memberCount} member${soloBracket.memberCount === 1 ? "" : "s"}`
              : `In ${allMemberships.length} brackets`}
          </div>
        </div>
        <span className="spacer" />
      </div>

      <div className="screen">
        {liveMatches.length > 0 ? (
          <LiveBlock match={liveMatches[0]} watching={0 /* TODO: presence */} />
        ) : null}

        {nextMatch ? <NextBlock match={nextMatch} myPick={nextMyPick} /> : <EmptyDay />}

        <Link
          href="/schedule"
          className="btn ghost block"
          style={{
            justifyContent: "space-between",
            textDecoration: "none",
            marginTop: -4,
            border: "1.5px dashed var(--stout-12)",
          }}
        >
          <span>See full schedule</span>
          <span className="dim">›</span>
        </Link>

        {soloBracket ? (
          <HomeInviteCard inviteCode={soloBracket.inviteCode} groupName={soloBracket.groupName} />
        ) : null}

        <BracketStandings
          brackets={allMemberships.map((g) => ({
            groupId: g.groupId,
            groupName: g.groupName,
            memberCount: g.memberCount,
          }))}
          userId={member.userId}
        />

        <div className="section-label" style={{ marginTop: 8 }}>
          <span className="caps-label">Your stats</span>
        </div>

        <div className="card elevated">
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <div className="stat-cell">
              <div className="stat-num">{stats.drinks}</div>
              <div className="stat-label">Drinks</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num" style={{ color: "var(--burn)" }}>{stats.wcc}</div>
              <div className="stat-label" style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                <WccIcon size={12} /> WCC
                <InfoChip label="What is WCC?">
                  <strong>World Cup Cups.</strong> +1 per basic drink, +2 per country beer. Win more from correct picks (1 + 2× stake). Drives the leaderboard.
                </InfoChip>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
              paddingTop: 14,
              borderTop: "1px solid var(--stout-12)",
            }}
          >
            <div>
              <span className="t-small muted">Passport</span>
              <span className="t-sub tnum" style={{ marginLeft: 6 }}>
                {stats.stamps}
                <span className="muted">/48</span>
              </span>
            </div>
            <Link href="/passport" className="link" style={{ textDecoration: "none" }}>
              View →
            </Link>
          </div>
        </div>

        <div style={{ height: 8 }} />
      </div>
    </>
  );
}
