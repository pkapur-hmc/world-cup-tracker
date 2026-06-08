import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/membership";
import { getMatchesForTeam, type Match } from "@/lib/fixtures";
import { createClient } from "@/lib/supabase/server";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { COUNTRY_BEERS } from "@/data/country-beers";
import { BackButton } from "@/components/ui/BackButton";

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

function flag(code: string | null) {
  return code ? FLAG_EMOJI[code] ?? "" : "";
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function teamResult(match: Match, code: string): "W" | "L" | "D" | null {
  if (match.status !== "final") return null;
  if (match.winner_code === code) return "W";
  if (match.winner_code === null) return "D";
  return "L";
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  if (!FLAG_EMOJI[code]) notFound();

  const member = await getCurrentMembership();
  if (!member) return null;

  const supabase = await createClient();
  const [matches, { data: teamRow }] = await Promise.all([
    getMatchesForTeam(code),
    supabase.from("wc_teams").select("group_letter, name").eq("code", code).maybeSingle(),
  ]);

  const team = (teamRow as { group_letter: string | null; name: string } | null) ?? null;
  const name = team?.name ?? NAMES[code] ?? code;
  const groupLetter = team?.group_letter ?? null;

  // Pull your drinks tied to any of these matches in one query
  const matchIds = matches.map((m) => m.id);
  const [drinksRes, picksRes, stampsRes] = await Promise.all([
    matchIds.length
      ? supabase
          .from("wc_drinks")
          .select("match_id, country_code")
          .eq("user_id", member.userId)
          .eq("group_id", member.groupId)
          .in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    matchIds.length
      ? supabase
          .from("wc_picks")
          .select("match_id, pick, stake, settled_at, payout_wcc, payout_wcp")
          .eq("user_id", member.userId)
          .eq("group_id", member.groupId)
          .in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("wc_drinks")
      .select("beer_label, created_at")
      .eq("user_id", member.userId)
      .eq("country_code", code)
      .not("beer_label", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  const drinksByMatch = new Map<number, number>();
  const countryBeerByMatch = new Map<number, number>();
  for (const d of (drinksRes.data ?? []) as { match_id: number | null; country_code: string | null }[]) {
    if (d.match_id == null) continue;
    drinksByMatch.set(d.match_id, (drinksByMatch.get(d.match_id) ?? 0) + 1);
    if (d.country_code === code) {
      countryBeerByMatch.set(d.match_id, (countryBeerByMatch.get(d.match_id) ?? 0) + 1);
    }
  }

  const pickByMatch = new Map<number, { pick: "A" | "D" | "B"; stake: number; settled_at: string | null; payout_wcp: number; payout_wcc: number }>();
  for (const p of (picksRes.data ?? []) as { match_id: number; pick: "A" | "D" | "B"; stake: number; settled_at: string | null; payout_wcp: number; payout_wcc: number }[]) {
    pickByMatch.set(p.match_id, p);
  }

  const beerStamps = ((stampsRes.data ?? []) as { beer_label: string; created_at: string }[]);
  const stampedBeer = beerStamps[0];

  // Tally W-L-D + total drinks + total country-beer pours
  const totals = matches.reduce(
    (acc, m) => {
      const r = teamResult(m, code);
      if (r === "W") acc.w++;
      else if (r === "L") acc.l++;
      else if (r === "D") acc.d++;
      acc.drinks += drinksByMatch.get(m.id) ?? 0;
      acc.beers += countryBeerByMatch.get(m.id) ?? 0;
      return acc;
    },
    { w: 0, l: 0, d: 0, drinks: 0, beers: 0 },
  );

  const upcoming = matches.filter((m) => m.status === "scheduled");
  const played = matches.filter((m) => m.status === "final");
  const live = matches.filter((m) => m.status === "live");
  const postponed = matches.filter((m) => m.status === "postponed");

  return (
    <>
      <div className="appbar">
        <BackButton fallback="/" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 30, lineHeight: 1 }}>{flag(code)}</span>
          <div>
            <div className="t-h2">{name}</div>
            <div className="t-small muted">
              {code}
              {groupLetter ? ` · Group ${groupLetter}` : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="screen" style={{ gap: 16 }}>
        <div className="card elevated">
          <div className="stat-grid">
            <div className="stat-cell">
              <div className="stat-num">{totals.w}-{totals.l}-{totals.d}</div>
              <div className="stat-label">W-L-D</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{totals.drinks}</div>
              <div className="stat-label">Your drinks</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num">{totals.beers}</div>
              <div className="stat-label">Country beers</div>
            </div>
            <div className="stat-cell">
              <div className="stat-num" style={{ color: stampedBeer ? "var(--pitch)" : "var(--stout-35)" }}>
                {stampedBeer ? "✓" : "·"}
              </div>
              <div className="stat-label">Stamp</div>
            </div>
          </div>
          {stampedBeer ? (
            <div className="t-small muted" style={{ marginTop: 10, textAlign: "center" }}>
              Stamped with <strong style={{ color: "var(--stout)" }}>{stampedBeer.beer_label}</strong> on{" "}
              {shortDate(stampedBeer.created_at)}
            </div>
          ) : null}
        </div>

        <FindBeersNearMe code={code} />

        {live.length > 0 ? (
          <Section title="Live" matches={live} />
        ) : null}
        {upcoming.length > 0 ? (
          <Section title={`Upcoming · ${upcoming.length}`} matches={upcoming} />
        ) : null}
        {played.length > 0 ? (
          <Section title={`Played · ${played.length}`} matches={played} reverse />
        ) : null}
        {postponed.length > 0 ? (
          <Section title="Postponed" matches={postponed} muted />
        ) : null}

        {matches.length === 0 ? (
          <div className="card empty-block" style={{ textAlign: "center" }}>
            <div className="empty-lead">No matches scheduled.</div>
            <div className="empty-sub">Knockouts fill in after the group stage.</div>
          </div>
        ) : null}

        <div style={{ height: 16 }} />
      </div>
    </>
  );

  function Section({
    title,
    matches: list,
    reverse,
    muted,
  }: {
    title: string;
    matches: Match[];
    reverse?: boolean;
    muted?: boolean;
  }) {
    const ordered = reverse ? list.slice().reverse() : list;
    return (
      <div>
        <div className="section-label">
          <span className="caps-label">{title}</span>
        </div>
        <div className="card" style={{ padding: 0 }}>
          {ordered.map((m, i) => {
            const isHome = m.team_a_code === code;
            const opponent = isHome ? m.team_b_code : m.team_a_code;
            const result = teamResult(m, code);
            const my = pickByMatch.get(m.id);
            const drinks = drinksByMatch.get(m.id) ?? 0;
            const beers = countryBeerByMatch.get(m.id) ?? 0;
            return (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  textDecoration: "none",
                  color: "inherit",
                  borderTop: i === 0 ? "none" : "1px solid var(--stout-12)",
                  opacity: muted ? 0.55 : 1,
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{flag(opponent)}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {isHome ? "vs" : "@"} {opponent ?? "TBD"}
                    {m.stage === "group" && m.group_letter ? (
                      <span className="muted" style={{ fontWeight: 500 }}> · Group {m.group_letter}</span>
                    ) : null}
                    {m.stage !== "group" ? (
                      <span className="muted" style={{ fontWeight: 500 }}> · {m.stage.toUpperCase()}</span>
                    ) : null}
                  </div>
                  <div className="t-small muted">
                    {shortDate(m.kickoff_at)} · {timeOfDay(m.kickoff_at)}
                    {drinks > 0 ? ` · ${drinks} drink${drinks === 1 ? "" : "s"}` : ""}
                    {beers > 0 ? ` · ${beers} country beer${beers === 1 ? "" : "s"}` : ""}
                    {my && my.settled_at && my.payout_wcp > 0 ? ` · +${my.payout_wcp} WCP` : ""}
                    {my && my.settled_at && my.payout_wcp === 0 && my.stake > 0 ? ` · -${my.stake} WCC` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {result ? (
                    <span
                      style={{
                        fontFamily: "var(--ff-display)",
                        fontWeight: 800,
                        fontSize: 14,
                        color:
                          result === "W"
                            ? "var(--pitch)"
                            : result === "L"
                              ? "var(--penalty)"
                              : "var(--stout-55)",
                      }}
                    >
                      {result}
                    </span>
                  ) : null}
                  {m.status === "live" ? (
                    <span className="badge live">
                      <span className="dot" />
                      Live
                    </span>
                  ) : null}
                  {m.status === "final" && m.score_a != null && m.score_b != null ? (
                    <span className="t-sub tnum">
                      {m.score_a}-{m.score_b}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }
}

function FindBeersNearMe({ code }: { code: string }) {
  const beers = COUNTRY_BEERS[code] ?? [];
  if (beers.length === 0) return null;
  const query = encodeURIComponent(beers.slice(0, 3).map((b) => b.name).join(" OR ") + " beer near me");
  return (
    <a
      href={`https://www.google.com/search?q=${query}`}
      target="_blank"
      rel="noopener noreferrer"
      className="btn secondary block"
      style={{ textDecoration: "none" }}
    >
      Find a {NAMES[code] ?? code} beer near me →
    </a>
  );
}
