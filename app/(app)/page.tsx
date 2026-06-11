import Image from "next/image";
import Link from "next/link";
import { getAllMemberships, getCurrentMembership, getCrossBracketMembers } from "@/lib/membership";
import { BracketStandings } from "./BracketStandings";
import {
  getLiveMatches,
  getNextMatch,
  tournamentStarted,
  TOURNAMENT_KICKOFF_ISO,
  type Match,
} from "@/lib/fixtures";
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
  const urgent = isKickoffSoon(match.kickoff_at);
  const tagLabel = myPick
    ? "Locked"
    : urgent
      ? `Locks ${countdownTo(match.kickoff_at)}`
      : "Next up";

  return (
    <Link href={`/match/${match.id}`} className="hero-action upcoming" style={cardStyle}>
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

/**
 * Pre-tournament home hero, shown until the first real kickoff. The one job:
 * tell people picks are open NOW and preview the drinking game so Thursday
 * isn't a surprise. Copy mirrors the HelpSheet (the canonical rules) - if a
 * number changes there, change it here too.
 */
function PreCupWelcome() {
  return (
    <div className="precup-card">
      <Image src="/crest.svg" alt="World Cup Cup" width={88} height={88} priority />
      <div className="precup-title">Welcome to the World Cup Cup</div>
      <div className="caps-label precup-kickoff">
        First whistle Thursday · kicks off {countdownTo(TOURNAMENT_KICKOFF_ISO)}
      </div>
      <div className="precup-rows">
        <div className="precup-row">
          <span className="precup-icon" aria-hidden>🎯</span>
          <div>
            <div className="precup-row-lead">Picks are open now</div>
            <div className="precup-row-sub">
              Feeling sure about a match? Call the winner whenever you like -
              picks stay open until that game kicks off. Every right call pays{" "}
              <strong>+1 WCC</strong>, and once you&apos;re holding cups you can
              stake them on a pick to multiply the payout.
            </div>
          </div>
        </div>
        <div className="precup-row">
          <span className="precup-icon" aria-hidden>🍺</span>
          <div>
            <div className="precup-row-lead">Pouring opens at kickoff</div>
            <div className="precup-row-sub">
              Any drink logged during a live match: <strong>+1 WCC</strong>. The
              playing country&apos;s beer - a Modelo while Mexico plays -{" "}
              <strong>+2 WCC</strong>.
            </div>
          </div>
        </div>
        <div className="precup-row">
          <span className="precup-icon" aria-hidden>🛂</span>
          <div>
            <div className="precup-row-lead">Stamps build your passport</div>
            <div className="precup-row-sub">
              Country beers also stamp your passport. 48 countries to collect
              between now and the final.
            </div>
          </div>
        </div>
      </div>
      <Link href="/schedule" className="btn primary block">
        Make your first picks
      </Link>
      <div className="precup-foot">
        Full rules any time under the <strong>?</strong> up top.
      </div>
    </div>
  );
}

function HowToWinPanel() {
  return (
    <div className="how-to-win">
      <div className="how-to-win-title">How to Win</div>
      <div className="how-to-win-sub">
        Stack <WccIcon size={12} /> WCC four ways
      </div>
      <div className="three-verbs" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
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
        <div className="verb">
          <span className="verb-icon" aria-hidden>📔</span>
          <div className="verb-name">Collect</div>
          <div className="verb-reward">+5 a country</div>
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

  // Pre-cup: until the first real whistle the welcome takes the top slot and
  // replaces HowToWinPanel (it carries the same three verbs with fuller copy).
  // Deliberately ignores live TEST matches so the state is visible pre-launch.
  const preCup = !tournamentStarted();

  return (
    <div className="screen home-screen">
      {preCup ? <PreCupWelcome /> : null}

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
        liveMatches.map((m) => <LiveHero key={m.id} match={m} />)
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

      {preCup ? null : <HowToWinPanel />}

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
