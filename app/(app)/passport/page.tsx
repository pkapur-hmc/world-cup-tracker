import Link from "next/link";
import { getCurrentMembership } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";
import { FLAG_EMOJI } from "@/data/flag-emojis";

type Stamp = {
  country_code: string;
  beer_label: string | null;
  created_at: string;
};

const ALL_CODES = Object.keys(FLAG_EMOJI);

function flag(code: string) {
  return FLAG_EMOJI[code] ?? "";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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

export default async function PassportPage() {
  const member = await getCurrentMembership();
  if (!member) return null;

  const supabase = await createClient();
  const [stampsRes, upcomingRes] = await Promise.all([
    supabase
      .from("wc_drinks")
      .select("country_code, beer_label, created_at")
      .eq("user_id", member.userId)
      .not("country_code", "is", null)
      .order("created_at", { ascending: false }),
    // One query gets every team's next match in one pass.
    supabase
      .from("wc_matches")
      .select("team_a_code, team_b_code, kickoff_at, status")
      .in("status", ["scheduled", "live"])
      .order("kickoff_at"),
  ]);

  const stamps = (stampsRes.data ?? []) as Stamp[];
  // Discard the upcoming-match query for now; the team page surfaces next-match info.
  void upcomingRes;
  // first-time stamp per country
  const seen = new Set<string>();
  const claimed: Stamp[] = [];
  for (const s of stamps) {
    if (!seen.has(s.country_code)) {
      seen.add(s.country_code);
      claimed.push(s);
    }
  }
  const claimedCodes = new Set(claimed.map((s) => s.country_code));
  const unclaimedCodes = ALL_CODES.filter((c) => !claimedCodes.has(c));

  const total = ALL_CODES.length;
  const claimedCount = claimed.length;
  const fillPct = Math.round((claimedCount / total) * 100);

  return (
    <>
      <div className="appbar">
        <div style={{ flex: 1 }}>
          <div className="caps-label" style={{ color: "var(--burn)" }}>🛂 Your passport</div>
          <div className="t-h1 tnum">
            {claimedCount} <span className="muted">of {total}</span>
          </div>
          <div className="pp-progress">
            <div className="fill" style={{ width: `${fillPct}%` }} />
          </div>
        </div>
      </div>

      <div className="screen" style={{ gap: 16 }}>
        {claimedCount === 0 ? (
          <div className="card empty-block" style={{ textAlign: "center" }}>
            <div className="empty-lead">Fresh booklet.</div>
            <div className="empty-sub">
              Pour a country beer during their match to stamp it.
            </div>
          </div>
        ) : (
          <div>
            <div className="section-label">
              <span className="caps-label">Claimed · {claimedCount}</span>
              <span className="t-small muted">Most recent first</span>
            </div>
            <div className="claimed-grid">
              {claimed.map((s) => (
                <Link
                  key={s.country_code}
                  href={`/team/${s.country_code}`}
                  className="claimed-card"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="stamp-mark">✓</div>
                  <div className="stamp-circle">
                    <div className="ring" />
                    <span className="country-flag">{flag(s.country_code)}</span>
                  </div>
                  <div className="country">{NAMES[s.country_code] ?? s.country_code}</div>
                  {s.beer_label ? <div className="beer">{s.beer_label}</div> : null}
                  <div className="date">{shortDate(s.created_at)}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {unclaimedCodes.length > 0 ? (
          <div>
            <div className="section-label">
              <span className="caps-label">Unclaimed · {unclaimedCodes.length}</span>
              <span className="t-small muted">Tap to see their games</span>
            </div>
            <div className="unclaimed-grid">
              {unclaimedCodes.map((code) => (
                <Link
                  key={code}
                  href={`/team/${code}`}
                  className="unclaimed-cell"
                  aria-label={NAMES[code] ?? code}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {flag(code)}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ height: 16 }} />
      </div>
    </>
  );
}
