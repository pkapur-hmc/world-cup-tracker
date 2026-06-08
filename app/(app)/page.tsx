import Link from "next/link";
import Image from "next/image";
import { getCurrentMembership } from "@/lib/membership";
import { getLiveMatches, getNextMatch, type Match } from "@/lib/fixtures";
import { getMemberStats, getRankInGroup } from "@/lib/stats";
import { getGroupPicksForMatch } from "@/lib/picks";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { colorFor } from "@/data/country-colors";
import { WccIcon, WcpIcon } from "@/components/ui/CurrencyIcon";
import { InfoChip } from "@/components/ui/InfoChip";
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

function timeOfDay(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
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
  const pickFlag =
    myPick?.pick === "A"
      ? flag(match.team_a_code)
      : myPick?.pick === "B"
        ? flag(match.team_b_code)
        : myPick?.pick === "D"
          ? "•"
          : "";
  const pickLabel =
    myPick?.pick === "A"
      ? match.team_a_code ?? "A"
      : myPick?.pick === "B"
        ? match.team_b_code ?? "B"
        : myPick?.pick === "D"
          ? "Draw"
          : "";
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
            <div className="t-h2 tnum">{timeOfDay(match.kickoff_at)}</div>
            <div className="t-small muted">{dayLabel(match.kickoff_at)}</div>
          </div>
        </div>

        {myPick ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginTop: 12,
              padding: "10px 12px",
              background: pickedCode ? "var(--foam-lit)" : "var(--paper)",
              border: pickedCode ? `1.5px solid ${accent.primary}` : "1px solid var(--stout-12)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="caps-label">Your pick</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="flag">{pickFlag}</span>
                <span className="t-sub">{pickLabel}</span>
              </span>
            </div>
            {myPick.stake > 0 ? (
              <span
                className="badge stake tnum"
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <WccIcon size={12} /> {myPick.stake} staked
              </span>
            ) : (
              <span className="t-small muted">no stake</span>
            )}
          </div>
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

  const [liveMatches, nextMatch, stats, rank] = await Promise.all([
    getLiveMatches(),
    getNextMatch(),
    getMemberStats(member.groupId, member.userId),
    getRankInGroup(member.groupId, member.userId),
  ]);

  let nextMyPick: MyPick = null;
  if (nextMatch) {
    const picks = await getGroupPicksForMatch(member.groupId, nextMatch.id);
    const mine = picks.find((p) => p.userId === member.userId);
    if (mine?.pick) nextMyPick = { pick: mine.pick, stake: mine.stake };
  }

  return (
    <>
      <div className="appbar">
        <Image className="mark" src="/mark.svg" alt="" width={36} height={36} />
        <div>
          <div className="group-name">{member.groupName}</div>
          <div className="group-meta">
            {member.memberCount} member{member.memberCount === 1 ? "" : "s"}
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

        <HomeInviteCard inviteCode={member.inviteCode} groupName={member.groupName} />

        <div className="section-label" style={{ marginTop: 8 }}>
          <span className="caps-label">Your standing</span>
          <span className="t-small muted">
            #{rank.rank} of {rank.total}
            {rank.aheadName ? ` - ${rank.aheadName}'s ahead` : ""}
          </span>
        </div>

        <div className="card elevated">
          <div className="stat-grid">
            <div className="stat-cell">
              <div className="stat-num">{stats.drinks}</div>
              <div className="stat-label">Drinks</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{stats.wcc}</div>
              <div className="stat-label" style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                <WccIcon size={12} /> WCC
                <InfoChip label="What is WCC?">
                  <strong>World Cup Cups.</strong> +1 per basic drink, +2 per country beer. Spend on stakes.
                </InfoChip>
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{stats.wcp}</div>
              <div className="stat-label" style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                <WcpIcon size={12} /> WCP
                <InfoChip label="What is WCP?">
                  <strong>World Cup Points.</strong> Earned from correct picks (1 + 2× stake) and from country beers (+1 each). Drives the leaderboard.
                </InfoChip>
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-num" style={{ color: "var(--burn)" }}>
                {stats.total}
              </div>
              <div className="stat-label">Total</div>
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
