import Link from "next/link";
import { getAllMemberships, getCurrentMembership, getCrossBracketMembers } from "@/lib/membership";
import { BracketStandings } from "./BracketStandings";
import { getLiveMatches, getNextMatch, type Match } from "@/lib/fixtures";
import { getMemberStats, getRankInGroup } from "@/lib/stats";
import { getPicksForUsersInMatch, hasUserEverPicked } from "@/lib/picks";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { colorFor } from "@/data/country-colors";
import { WccIcon } from "@/components/ui/CurrencyIcon";
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
function isKickoffSoon(iso: string, withinMs = 12 * 60 * 60 * 1000): boolean {
  return new Date(iso).getTime() - Date.now() < withinMs;
}

function stageLabel(match: Match) {
  return match.group_letter ? `Group ${match.group_letter}` : match.stage.toUpperCase();
}

function LiveHero({ match }: { match: Match }) {
  return (
    <Link href={`/match/${match.id}`} className="hero-action live">
      <div className="hero-tag">
        <span className="badge live"><span className="dot" />Live</span>
        <span className="hero-tag-meta">{stageLabel(match)}</span>
      </div>
      <div className="hero-score">
        <span className="flag lg">{flag(match.team_a_code)}</span>
        <span className="t-display tnum">{match.score_a ?? 0}</span>
        <span className="dim" style={{ fontFamily: "var(--ff-display)", fontSize: 22 }}>-</span>
        <span className="t-display tnum">{match.score_b ?? 0}</span>
        <span className="flag lg">{flag(match.team_b_code)}</span>
      </div>
      <div className="hero-cta">
        <span className="hero-cta-icon" aria-hidden>🍺</span>
        <div>
          <div className="hero-cta-lead">Tap to log a drink</div>
          <div className="hero-cta-sub">
            +1 WCC · +2 for a country beer 🛂
          </div>
        </div>
        <span className="hero-cta-chev" aria-hidden>›</span>
      </div>
    </Link>
  );
}

function UpcomingHero({ match, myPick }: { match: Match; myPick: MyPick }) {
  const pickedCode =
    myPick?.pick === "A"
      ? match.team_a_code
      : myPick?.pick === "B"
        ? match.team_b_code
        : null;
  const accent = colorFor(pickedCode);
  const urgent = isKickoffSoon(match.kickoff_at);
  const tagLabel = myPick
    ? "Locked"
    : urgent
      ? `Locks ${countdownTo(match.kickoff_at)}`
      : "Next up";

  return (
    <Link
      href={`/match/${match.id}`}
      className="hero-action upcoming"
      style={
        pickedCode
          ? {
              borderLeft: `4px solid ${accent.primary}`,
              background: accent.tint,
            }
          : undefined
      }
    >
      <div className="hero-tag">
        <span className={`caps-label ${urgent && !myPick ? "urgent" : ""}`}>{tagLabel}</span>
        <span className="hero-tag-meta">
          {stageLabel(match)} · {countdownTo(match.kickoff_at)}
        </span>
      </div>
      <div className="hero-matchup">
        <span className="flag lg">{flag(match.team_a_code)}</span>
        <span className="t-h1">{tlaShort(match.team_a_code)}</span>
        <span className="dim" style={{ fontFamily: "var(--ff-display)", fontSize: 22 }}>vs</span>
        <span className="t-h1">{tlaShort(match.team_b_code)}</span>
        <span className="flag lg">{flag(match.team_b_code)}</span>
      </div>
      <div className="hero-meta-row">
        <LocalTime iso={match.kickoff_at} mode="dayShort" /> · <LocalTime iso={match.kickoff_at} mode="time" />
        {match.venue ? <> · {match.venue}</> : null}
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

      <div className="hero-cta">
        <span className="hero-cta-icon" aria-hidden>🎯</span>
        <div>
          <div className="hero-cta-lead">{myPick ? "Edit your pick" : "Pick a winner"}</div>
          <div className="hero-cta-sub">
            {myPick ? "Adjust before kickoff locks it in" : "+1 WCC if right · stake to multiply"}
          </div>
        </div>
        <span className="hero-cta-chev" aria-hidden>›</span>
      </div>
    </Link>
  );
}

function NextUpRow({ match }: { match: Match }) {
  return (
    <Link href={`/match/${match.id}`} className="next-up-row">
      <span className="caps-label">Then</span>
      <span className="next-up-teams">
        {flag(match.team_a_code)} {tlaShort(match.team_a_code)}
        <span className="dim"> vs </span>
        {tlaShort(match.team_b_code)} {flag(match.team_b_code)}
      </span>
      <span className="next-up-time tnum">{countdownTo(match.kickoff_at)}</span>
    </Link>
  );
}

function HowToWinPanel() {
  return (
    <div className="how-to-win">
      <div className="how-to-win-title">How to Win</div>
      <div className="how-to-win-sub">
        Stack <WccIcon size={12} /> WCC three ways
      </div>
      <div className="three-verbs">
        <div className="verb">
          <span className="verb-icon" aria-hidden>🍺</span>
          <div className="verb-name">Drink</div>
          <div className="verb-reward">+1 WCC</div>
        </div>
        <div className="verb">
          <span className="verb-icon" aria-hidden>🎯</span>
          <div className="verb-name">Pick</div>
          <div className="verb-reward">+1 if right</div>
        </div>
        <div className="verb">
          <span className="verb-icon" aria-hidden>🛂</span>
          <div className="verb-name">Stamp</div>
          <div className="verb-reward">+2 + flag</div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  wcc,
  drinks,
  stamps,
  rank,
  total,
  bracketName,
  bracketCount,
}: {
  wcc: number;
  drinks: number;
  stamps: number;
  rank: number | null;
  total: number | null;
  bracketName: string | null;
  bracketCount: number;
}) {
  return (
    <div className="status-card">
      <div className="status-eyebrow">Your cup</div>
      <div className="status-wcc-row">
        <span className="status-wcc tnum">{wcc}</span>
        <span className="status-wcc-unit">
          <WccIcon size={20} />
          <span>WCC</span>
        </span>
      </div>
      {bracketName && rank != null && total != null ? (
        <div className="status-rank">
          <strong>#{rank}</strong>
          <span className="dim"> of {total} </span>
          in <strong>{bracketName}</strong>
        </div>
      ) : bracketCount > 1 ? (
        <div className="status-rank">
          Tracked across <strong>{bracketCount}</strong> brackets
        </div>
      ) : null}
      <div className="status-substats">
        <div className="status-substat">
          <span className="ss-num tnum">{drinks}</span>
          <span className="ss-label">Drinks</span>
        </div>
        <div className="status-substat">
          <span className="ss-num tnum">{stamps}</span>
          <span className="ss-label">Stamps</span>
        </div>
        <div className="status-substat">
          <span className="ss-num tnum">{stamps}/48</span>
          <span className="ss-label">Passport</span>
        </div>
      </div>
    </div>
  );
}

function OnboardingChecklist({
  picked,
  drank,
  stamped,
}: {
  picked: boolean;
  drank: boolean;
  stamped: boolean;
}) {
  if (picked && drank && stamped) return null;
  const items = [
    { done: picked, label: "Make your first pick", href: "/schedule" },
    { done: drank, label: "Pour your first drink", href: null },
    { done: stamped, label: "Earn your first stamp", href: null },
  ];
  return (
    <div className="onboarding-checklist">
      <div className="caps-label" style={{ marginBottom: 6 }}>
        Getting started
      </div>
      {items.map((it, i) => {
        const inner = (
          <>
            <span className={`ck-box ${it.done ? "ck-done" : ""}`} aria-hidden>
              {it.done ? "✓" : ""}
            </span>
            <span className={`ck-label ${it.done ? "ck-label-done" : ""}`}>
              {it.label}
            </span>
            {it.href && !it.done ? <span className="ck-chev" aria-hidden>›</span> : null}
          </>
        );
        return it.href && !it.done ? (
          <Link key={i} href={it.href} className="ck-row ck-link">
            {inner}
          </Link>
        ) : (
          <div key={i} className="ck-row">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function EmptyDay() {
  return (
    <div className="card empty-block" style={{ textAlign: "center" }}>
      <div className="empty-lead">Almost kickoff.</div>
      <div className="empty-sub">
        Open the <Link href="/schedule" className="link">Schedule</Link> to lock your picks early — +1 WCC for each right call, more if you stake.
      </div>
    </div>
  );
}

export default async function HomePage() {
  const member = await getCurrentMembership();
  if (!member) return null; // layout already handled redirects
  const allMemberships = await getAllMemberships();
  const inMultiple = allMemberships.length > 1;
  const soloBracket = inMultiple ? null : allMemberships[0] ?? null;

  const [liveMatches, nextMatch, stats, crossBracketMembers, everPicked, soloRank] = await Promise.all([
    getLiveMatches(),
    getNextMatch(),
    getMemberStats("", member.userId),
    getCrossBracketMembers(member.userId),
    hasUserEverPicked(member.userId),
    soloBracket
      ? getRankInGroup(soloBracket.groupId, member.userId)
      : Promise.resolve(null),
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
    <div className="screen home-screen">
      <StatusCard
        wcc={stats.wcc}
        drinks={stats.drinks}
        stamps={stats.stamps}
        rank={soloRank?.rank ?? null}
        total={soloRank?.total ?? null}
        bracketName={soloBracket?.groupName ?? null}
        bracketCount={allMemberships.length}
      />

      {liveMatches.length > 0 ? (
        <LiveHero match={liveMatches[0]} />
      ) : nextMatch ? (
        <UpcomingHero match={nextMatch} myPick={nextMyPick} />
      ) : (
        <EmptyDay />
      )}

      {liveMatches.length > 0 && nextMatch ? <NextUpRow match={nextMatch} /> : null}

      <OnboardingChecklist
        picked={everPicked}
        drank={stats.drinks > 0}
        stamped={stats.stamps > 0}
      />

      <HowToWinPanel />

      {allMemberships.length > 1 ? (
        <BracketStandings
          brackets={allMemberships.map((g) => ({
            groupId: g.groupId,
            groupName: g.groupName,
            memberCount: g.memberCount,
          }))}
          userId={member.userId}
        />
      ) : null}

      {soloBracket ? (
        <HomeInviteCard inviteCode={soloBracket.inviteCode} groupName={soloBracket.groupName} />
      ) : null}

      <div style={{ height: 8 }} />
    </div>
  );
}
