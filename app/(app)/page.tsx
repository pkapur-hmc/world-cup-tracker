import Link from "next/link";
import Image from "next/image";
import { getCurrentMembership } from "@/lib/membership";
import { getLiveMatches, getNextMatch, type Match } from "@/lib/fixtures";
import { getMemberStats, getRankInGroup } from "@/lib/stats";
import { FLAG_EMOJI } from "@/data/flag-emojis";

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

function NextBlock({ match }: { match: Match }) {
  return (
    <>
      <div className="section-label" style={{ marginTop: 8 }}>
        <span className="caps-label">Next up</span>
        <span className="t-small muted tnum">{countdownTo(match.kickoff_at)}</span>
      </div>
      <div className="card">
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
          <div className="t-h2 tnum">{timeOfDay(match.kickoff_at)}</div>
        </div>
        <Link
          href={`/match/${match.id}`}
          className="btn primary block"
          style={{ marginTop: 14, textDecoration: "none" }}
        >
          Make your pick
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
        <Link href="/group" className="icon-btn" aria-label="Group settings">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </Link>
      </div>

      <div className="screen">
        {liveMatches.length > 0 ? (
          <LiveBlock match={liveMatches[0]} watching={0 /* TODO: presence */} />
        ) : null}

        {nextMatch ? <NextBlock match={nextMatch} /> : <EmptyDay />}

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
              <div className="stat-label">WCC</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{stats.wcp}</div>
              <div className="stat-label">WCP</div>
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
