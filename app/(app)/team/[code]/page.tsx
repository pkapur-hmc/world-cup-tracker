import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMembership } from "@/lib/membership";
import { getMatchesForTeam, type Match } from "@/lib/fixtures";
import { createClient } from "@/lib/supabase/server";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { COUNTRY_BEERS, type CountryBeer } from "@/data/country-beers";
import { colorFor } from "@/data/country-colors";
import { BackButton } from "@/components/ui/BackButton";
import { WccIcon } from "@/components/ui/CurrencyIcon";
import { CountryBottle } from "@/components/ui/CountryBottle";
import { InfoChip } from "@/components/ui/InfoChip";

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

/** Bar finder query: quoted beer name on Google Maps - finds bars whose
 *  menus mention the beer. Quotes force an exact-phrase match. */
function findBarUrl(beerName: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`"${beerName}" near me`)}`;
}

type MyPick = {
  pick: "A" | "D" | "B";
  stake: number;
  settled_at: string | null;
  payout_wcp: number;
  payout_wcc: number;
};

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
  const accent = colorFor(code);

  const matchIds = matches.map((m) => m.id);
  const [drinksRes, picksRes, stampsRes] = await Promise.all([
    matchIds.length
      ? supabase
          .from("wc_drinks")
          .select("match_id, country_code, beer_label")
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
  for (const d of (drinksRes.data ?? []) as { match_id: number | null; country_code: string | null; beer_label: string | null }[]) {
    if (d.match_id == null) continue;
    drinksByMatch.set(d.match_id, (drinksByMatch.get(d.match_id) ?? 0) + 1);
    if (d.country_code === code) {
      countryBeerByMatch.set(d.match_id, (countryBeerByMatch.get(d.match_id) ?? 0) + 1);
    }
  }

  const pickByMatch = new Map<number, MyPick>();
  for (const p of (picksRes.data ?? []) as (MyPick & { match_id: number })[]) {
    pickByMatch.set(p.match_id, p);
  }

  // All stamps for this country (lifetime, descending recency)
  const stamps = (stampsRes.data ?? []) as { beer_label: string; created_at: string }[];
  const stampsByLabel = new Map<string, { count: number; firstAt: string }>();
  for (const s of stamps) {
    const e = stampsByLabel.get(s.beer_label);
    if (e) e.count++;
    else stampsByLabel.set(s.beer_label, { count: 1, firstAt: s.created_at });
  }

  // Country beers list (all "stampable" beers for this country)
  const allBeers: CountryBeer[] = COUNTRY_BEERS[code] ?? [];
  const stampedCount = allBeers.filter((b) => stampsByLabel.has(b.name)).length;

  // Country W-L-D + goals
  const finals = matches.filter((m) => m.status === "final");
  const wld = finals.reduce(
    (acc, m) => {
      const r = teamResult(m, code);
      if (r === "W") acc.w++;
      else if (r === "L") acc.l++;
      else if (r === "D") acc.d++;
      const isHome = m.team_a_code === code;
      const gf = isHome ? m.score_a ?? 0 : m.score_b ?? 0;
      const ga = isHome ? m.score_b ?? 0 : m.score_a ?? 0;
      acc.gf += gf;
      acc.ga += ga;
      return acc;
    },
    { w: 0, l: 0, d: 0, gf: 0, ga: 0 },
  );

  // My pick performance specifically on this team's matches
  const myStats = matches.reduce(
    (acc, m) => {
      const p = pickByMatch.get(m.id);
      const drinks = drinksByMatch.get(m.id) ?? 0;
      const beers = countryBeerByMatch.get(m.id) ?? 0;
      acc.drinks += drinks;
      acc.beers += beers;
      if (!p?.pick) return acc;
      acc.picks++;
      const pickedThisCountry =
        (p.pick === "A" && m.team_a_code === code) ||
        (p.pick === "B" && m.team_b_code === code);
      const pickedAgainst =
        (p.pick === "A" && m.team_b_code === code) ||
        (p.pick === "B" && m.team_a_code === code);
      if (pickedThisCountry) acc.picksFor++;
      else if (pickedAgainst) acc.picksAgainst++;
      else acc.picksDraw++;
      if (p.settled_at && p.payout_wcp > 0) acc.correct++;
      acc.wcpEarned += p.settled_at ? p.payout_wcp : 0;
      acc.stakeSpent += p.stake;
      return acc;
    },
    {
      picks: 0,
      picksFor: 0,
      picksAgainst: 0,
      picksDraw: 0,
      correct: 0,
      wcpEarned: 0,
      stakeSpent: 0,
      drinks: 0,
      beers: 0,
    },
  );

  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const played = matches.filter((m) => m.status === "final");
  const postponed = matches.filter((m) => m.status === "postponed");

  return (
    <>
      {/* ---------- Hero ---------- */}
      <div className="appbar" style={{ paddingBottom: 0 }}>
        <BackButton fallback="/" />
        <div style={{ flex: 1 }} />
      </div>

      <div
        style={{
          margin: "0 0 8px",
          padding: "8px 20px 18px",
          background: `linear-gradient(180deg, ${accent.tint} 0%, transparent 100%)`,
          borderBottom: `3px solid ${accent.primary}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "var(--foam-lit)",
              border: `3px solid ${accent.primary}`,
              display: "grid",
              placeItems: "center",
              fontSize: 40,
              lineHeight: 1,
              flex: "0 0 72px",
              boxShadow: `0 4px 12px -2px ${accent.tint2}`,
            }}
          >
            {flag(code)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="t-h1" style={{ fontSize: 28 }}>{name}</div>
            <div className="t-small muted" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
              <span>{code}</span>
              {groupLetter ? (
                <>
                  <span>·</span>
                  <span
                    className="badge"
                    style={{
                      background: accent.primary,
                      color: readableInk(accent.primary),
                      padding: "2px 8px",
                    }}
                  >
                    Group {groupLetter}
                  </span>
                </>
              ) : null}
              {live.length > 0 ? (
                <span className="badge live">
                  <span className="dot" />
                  Live now
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Three accent stripes - country's flag-ish color band */}
        <div style={{ marginTop: 14, display: "flex", gap: 4, height: 6 }}>
          <span style={{ flex: 1, background: accent.primary, borderRadius: 3 }} />
          <span style={{ flex: 1, background: accent.secondary, borderRadius: 3 }} />
          <span style={{ flex: 1, background: accent.accent, borderRadius: 3 }} />
        </div>
      </div>

      <div className="screen" style={{ gap: 18, paddingTop: 6 }}>
        {/* ---------- Passport progress ---------- */}
        <section>
          <div className="section-label">
            <span className="caps-label" style={{ display: "inline-flex", alignItems: "center" }}>
              🛂 Passport stamps
              <InfoChip label="What are stamps?">
                One stamp per <strong>distinct {name} beer</strong> you&apos;ve ever logged. Collect them all and complete this country.
              </InfoChip>
            </span>
            <span className="t-small muted tnum">
              {stampedCount} / {allBeers.length}
            </span>
          </div>
          <div
            className="card"
            style={{
              background: `linear-gradient(${accent.tint}, ${accent.tint}), var(--foam-lit)`,
              borderColor: accent.primary,
            }}
          >
            {/* progress bar */}
            <div
              style={{
                height: 8,
                background: "var(--paper)",
                borderRadius: 999,
                overflow: "hidden",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${allBeers.length ? Math.round((stampedCount / allBeers.length) * 100) : 0}%`,
                  background: `linear-gradient(90deg, ${accent.primary}, ${accent.accent})`,
                  borderRadius: 999,
                  transition: "width 300ms ease",
                }}
              />
            </div>

            {/* Stamp grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              {allBeers.map((b) => {
                const s = stampsByLabel.get(b.name);
                const claimed = !!s;
                return (
                  <a
                    key={b.name}
                    href={findBarUrl(b.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`stamp-tile ${claimed ? "claimed" : ""}`}
                    style={{
                      background: claimed ? accent.tint2 : "transparent",
                      borderColor: claimed ? accent.primary : "var(--stout-35)",
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <CountryBottle countryCode={code} flag={flag(code)} size={42} />
                      {claimed ? (
                        <span
                          style={{
                            position: "absolute",
                            top: -4,
                            right: -8,
                            background: accent.primary,
                            color: readableInk(accent.primary),
                            border: "1.5px solid #1C140C",
                            borderRadius: 999,
                            fontFamily: "var(--ff-display)",
                            fontWeight: 800,
                            fontSize: 11,
                            padding: "1px 6px",
                            transform: "rotate(8deg)",
                          }}
                          aria-hidden
                        >
                          ×{s.count}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="stamp-name"
                      style={{ color: claimed ? "var(--stout)" : "var(--stout-55)" }}
                    >
                      {b.name}
                    </div>
                    <div className="t-small muted" style={{ fontSize: 10 }}>
                      {claimed ? `🛂 ${shortDate(s.firstAt)}` : "tap to find a bar →"}
                    </div>
                  </a>
                );
              })}
              {allBeers.length === 0 ? (
                <div className="t-small muted" style={{ gridColumn: "1 / -1", textAlign: "center" }}>
                  No curated beers for this country yet.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* ---------- Your numbers ---------- */}
        <section>
          <div className="section-label">
            <span className="caps-label">📊 Your numbers with {name}</span>
          </div>
          <div className="card elevated">
            <div className="stat-grid">
              <YourStat
                icon={<span aria-hidden>🎯</span>}
                num={`${myStats.correct}/${myStats.picks}`}
                label="Picks correct"
                accent={accent.primary}
              />
              <YourStat
                icon={<WccIcon size={14} />}
                num={myStats.wcpEarned}
                label="WCC won"
                accent={accent.primary}
              />
              <YourStat
                icon={<WccIcon size={14} />}
                num={myStats.beers * 2}
                label={`WCC from ${code}`}
                accent={accent.primary}
              />
              <YourStat
                icon={<span aria-hidden>🍻</span>}
                num={myStats.drinks}
                label="Drinks during"
                accent={accent.primary}
              />
            </div>
            {myStats.picks > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid var(--stout-12)",
                  flexWrap: "wrap",
                }}
              >
                <Pill label={`for ${name}`} value={myStats.picksFor} color={accent.primary} ink={readableInk(accent.primary)} />
                <Pill label="against" value={myStats.picksAgainst} color="var(--stout-12)" ink="var(--stout)" />
                {myStats.picksDraw ? (
                  <Pill label="draw" value={myStats.picksDraw} color="var(--paper)" ink="var(--stout)" />
                ) : null}
                {myStats.stakeSpent > 0 ? (
                  <span className="t-small muted" style={{ marginLeft: "auto", alignSelf: "center" }}>
                    <WccIcon size={11} /> {myStats.stakeSpent} staked
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="t-small muted" style={{ marginTop: 10, textAlign: "center" }}>
                No picks on {name} yet. Pick one of their matches to start.
              </div>
            )}
          </div>
        </section>

        {/* ---------- Their tournament ---------- */}
        <section>
          <div className="section-label">
            <span className="caps-label">🏆 {name}&apos;s tournament</span>
            <span className="t-small muted tnum">
              {finals.length} played · {upcoming.length} to go
            </span>
          </div>
          <div className="card" style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
            <WldChunk label="W" value={wld.w} color="var(--pitch)" />
            <WldChunk label="D" value={wld.d} color="var(--stout-55)" />
            <WldChunk label="L" value={wld.l} color="var(--penalty)" />
            <div
              style={{
                flex: 1,
                padding: "8px 14px",
                borderLeft: "1px solid var(--stout-12)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div className="caps-label">Goals</div>
              <div className="t-h2 tnum">
                {wld.gf} <span className="dim">/</span> {wld.ga}
              </div>
              <div className="t-small muted">
                {wld.gf - wld.ga >= 0 ? "+" : ""}
                {wld.gf - wld.ga} differential
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Per-match journal ---------- */}
        <section>
          <div className="section-label">
            <span className="caps-label">🗓️ Match journal</span>
          </div>
          {matches.length === 0 ? (
            <div className="card empty-block" style={{ textAlign: "center" }}>
              <div className="empty-lead">No matches scheduled.</div>
              <div className="empty-sub">Knockouts fill in after the group stage.</div>
            </div>
          ) : null}

          {live.length > 0 ? (
            <Journal title="Live" matches={live} kind="live" />
          ) : null}
          {upcoming.length > 0 ? (
            <Journal title={`Upcoming · ${upcoming.length}`} matches={upcoming} kind="upcoming" />
          ) : null}
          {played.length > 0 ? (
            <Journal title={`Played · ${played.length}`} matches={played} kind="played" reverse />
          ) : null}
          {postponed.length > 0 ? (
            <Journal title="Postponed" matches={postponed} kind="postponed" />
          ) : null}
        </section>

        <div style={{ height: 16 }} />
      </div>
    </>
  );

  function Journal({
    title,
    matches: list,
    kind,
    reverse,
  }: {
    title: string;
    matches: Match[];
    kind: "live" | "upcoming" | "played" | "postponed";
    reverse?: boolean;
  }) {
    const ordered = reverse ? list.slice().reverse() : list;
    return (
      <div style={{ marginBottom: 12 }}>
        <div
          className="caps-label"
          style={{ padding: "10px 4px 6px" }}
        >
          {title}
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {ordered.map((m, i) => {
            const isHome = m.team_a_code === code;
            const opponent = isHome ? m.team_b_code : m.team_a_code;
            const opponentName = opponent ? NAMES[opponent] ?? opponent : "TBD";
            const oppAccent = opponent ? colorFor(opponent) : null;
            const result = teamResult(m, code);
            const my = pickByMatch.get(m.id);
            const drinks = drinksByMatch.get(m.id) ?? 0;
            const beers = countryBeerByMatch.get(m.id) ?? 0;

            const pickedThisCountry = my?.pick && (
              (my.pick === "A" && isHome) || (my.pick === "B" && !isHome)
            );
            const pickedAgainst = my?.pick && (
              (my.pick === "A" && !isHome) || (my.pick === "B" && isHome)
            );
            const pickedDraw = my?.pick === "D";

            const settled = !!my?.settled_at;
            const pickCorrect = settled && (my?.payout_wcp ?? 0) > 0;

            return (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className="journal-row"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--stout-12)",
                  opacity: kind === "postponed" ? 0.55 : 1,
                  background: pickedThisCountry
                    ? accent.tint
                    : pickedAgainst && oppAccent
                      ? oppAccent.tint
                      : undefined,
                }}
              >
                {/* opponent + meta */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{flag(opponent)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="t-sub" style={{ fontSize: 14 }}>
                      {isHome ? "vs" : "@"} {opponentName}
                      <span className="muted" style={{ fontWeight: 500 }}>
                        {m.stage === "group" && m.group_letter ? ` · Group ${m.group_letter}` : ""}
                        {m.stage !== "group" ? ` · ${m.stage.toUpperCase()}` : ""}
                      </span>
                    </div>
                    <div className="t-small muted" style={{ marginTop: 1 }}>
                      {shortDate(m.kickoff_at)} · {timeOfDay(m.kickoff_at)}
                    </div>
                    {/* journal chips */}
                    {(my?.pick || drinks > 0 || beers > 0) ? (
                      <div className="journal-chips">
                        {my?.pick ? (
                          <span
                            className="j-chip"
                            style={{
                              background: pickedThisCountry
                                ? accent.primary
                                : pickedAgainst && oppAccent
                                  ? oppAccent.primary
                                  : "var(--paper)",
                              color: pickedThisCountry
                                ? readableInk(accent.primary)
                                : pickedAgainst && oppAccent
                                  ? readableInk(oppAccent.primary)
                                  : "var(--stout)",
                            }}
                          >
                            {pickedThisCountry
                              ? `You picked ${code}`
                              : pickedAgainst
                                ? `You picked ${opponent}`
                                : pickedDraw
                                  ? "You picked Draw"
                                  : "Picked"}
                          </span>
                        ) : (
                          kind === "upcoming" || kind === "live" ? (
                            <span className="j-chip dim">No pick yet</span>
                          ) : (
                            <span className="j-chip dim">Skipped</span>
                          )
                        )}
                        {settled ? (
                          <span
                            className="j-chip"
                            style={{
                              background: pickCorrect ? "var(--pitch)" : "var(--penalty)",
                              color: "var(--foam-lit)",
                            }}
                          >
                            {pickCorrect ? `+${my!.payout_wcp} WCC` : my!.stake > 0 ? `−${my!.stake} WCC` : "0 WCC"}
                          </span>
                        ) : null}
                        {beers > 0 ? (
                          <span className="j-chip" style={{ background: accent.tint2, color: accent.ink }}>
                            🛂 {beers} {code}
                          </span>
                        ) : null}
                        {drinks > beers && drinks > 0 ? (
                          <span className="j-chip" style={{ background: "var(--paper)", color: "var(--stout)" }}>
                            🍺 {drinks - beers} basic
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* right side: result / score / live */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                  {kind === "live" ? (
                    <span className="badge live"><span className="dot" />Live</span>
                  ) : null}
                  {result ? (
                    <span
                      style={{
                        fontFamily: "var(--ff-display)",
                        fontWeight: 800,
                        fontSize: 18,
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--foam-lit)",
                        background:
                          result === "W"
                            ? "var(--pitch)"
                            : result === "L"
                              ? "var(--penalty)"
                              : "var(--stout-55)",
                      }}
                      aria-label={result}
                    >
                      {result}
                    </span>
                  ) : null}
                  {(m.status === "final" || m.status === "live") && m.score_a != null && m.score_b != null ? (
                    <span className="t-sub tnum" style={{ minWidth: 36, textAlign: "right" }}>
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

function YourStat({
  icon,
  num,
  label,
  accent,
}: {
  icon: React.ReactNode;
  num: React.ReactNode;
  label: string;
  accent: string;
}) {
  return (
    <div className="stat-cell">
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "var(--paper)",
          color: accent,
          marginBottom: 6,
        }}
      >
        {icon}
      </div>
      <div className="stat-num tnum">{num}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Pill({
  label,
  value,
  color,
  ink,
}: {
  label: string;
  value: number;
  color: string;
  ink: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: color,
        color: ink,
        fontFamily: "var(--ff-ui)",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: "0.02em",
      }}
    >
      <strong className="tnum">{value}</strong> {label}
    </span>
  );
}

function WldChunk({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "10px 6px",
        textAlign: "center",
        borderRight: "1px solid var(--stout-12)",
      }}
    >
      <div
        className="t-display tnum"
        style={{ fontSize: 32, color, lineHeight: 1 }}
      >
        {value}
      </div>
      <div className="caps-label" style={{ marginTop: 2 }}>{label}</div>
    </div>
  );
}

function readableInk(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#1C140C";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.55 ? "#1C140C" : "#FFFEF2";
}
