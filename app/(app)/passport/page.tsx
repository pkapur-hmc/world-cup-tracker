import Image from "next/image";
import Link from "next/link";
import { getCurrentMembership } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";
import { FLAG_EMOJI } from "@/data/flag-emojis";
import { COUNTRY_BEERS } from "@/data/country-beers";
import { colorFor } from "@/data/country-colors";
import { CountryBottle } from "@/components/ui/CountryBottle";
import { LocalTime } from "@/components/ui/LocalTime";

type Stamp = {
  country_code: string;
  beer_label: string | null;
  created_at: string;
};

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

function flag(code: string) {
  return FLAG_EMOJI[code] ?? "";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Tallies for one country: which beers have been stamped, when first stamped,
 *  pour counts per beer. */
type CountryProgress = {
  code: string;
  name: string;
  totalBeers: number;
  claimedBeers: number;
  pours: number;
  stampsByLabel: Map<string, { count: number; firstAt: string }>;
  mostRecentAt: string | null;
};

function readableInk(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#1C140C";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.55 ? "#1C140C" : "#FFFEF2";
}

export default async function PassportPage() {
  const member = await getCurrentMembership();
  if (!member) return null;

  const supabase = await createClient();
  const { data: stampsData } = await supabase
    .from("wc_drinks")
    .select("country_code, beer_label, created_at")
    .eq("user_id", member.userId)
    .not("country_code", "is", null)
    .not("beer_label", "is", null)
    .order("created_at", { ascending: false });

  const stamps = (stampsData ?? []) as Stamp[];

  // Build progress per country - one entry for every country that has
  // curated beers defined (so unclaimed countries show too).
  const countriesWithBeers = Object.keys(COUNTRY_BEERS);
  const progressByCode = new Map<string, CountryProgress>();
  for (const code of countriesWithBeers) {
    progressByCode.set(code, {
      code,
      name: NAMES[code] ?? code,
      totalBeers: (COUNTRY_BEERS[code] ?? []).length,
      claimedBeers: 0,
      pours: 0,
      stampsByLabel: new Map(),
      mostRecentAt: null,
    });
  }

  for (const s of stamps) {
    const p = progressByCode.get(s.country_code);
    if (!p || !s.beer_label) continue;
    const entry = p.stampsByLabel.get(s.beer_label);
    if (entry) {
      entry.count++;
    } else {
      p.stampsByLabel.set(s.beer_label, { count: 1, firstAt: s.created_at });
    }
    p.pours++;
    if (!p.mostRecentAt || p.mostRecentAt < s.created_at) {
      p.mostRecentAt = s.created_at;
    }
  }
  for (const p of progressByCode.values()) {
    p.claimedBeers = p.stampsByLabel.size;
  }

  const totalBeers = countriesWithBeers.reduce(
    (s, c) => s + (COUNTRY_BEERS[c] ?? []).length,
    0,
  );
  const claimedTotal = Array.from(progressByCode.values()).reduce(
    (s, p) => s + p.claimedBeers,
    0,
  );
  const fillPct = totalBeers === 0 ? 0 : Math.round((claimedTotal / totalBeers) * 100);

  const claimed = Array.from(progressByCode.values())
    .filter((p) => p.claimedBeers > 0)
    .sort(
      (a, b) =>
        (b.mostRecentAt ?? "").localeCompare(a.mostRecentAt ?? "") ||
        b.claimedBeers - a.claimedBeers,
    );
  const unclaimed = Array.from(progressByCode.values())
    .filter((p) => p.claimedBeers === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="appbar" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div className="caps-label" style={{ color: "var(--burn)" }}>🛂 Your passport</div>
          <div className="t-h1 tnum">
            {claimedTotal} <span className="muted">of {totalBeers}</span>
          </div>
          <div className="t-small muted" style={{ marginTop: 2 }}>
            {claimed.length} of {progressByCode.size} countries started ·{" "}
            {Array.from(progressByCode.values()).reduce((s, p) => s + p.pours, 0)} total pours
          </div>
          <div className="pp-progress" style={{ marginTop: 8 }}>
            <div
              className="fill"
              style={{
                width: `${fillPct}%`,
                background: "linear-gradient(90deg, var(--pour), var(--burn))",
              }}
            />
          </div>
        </div>
        {/* Embossed cover seal - the one place in-app the full crest appears. */}
        <Image src="/crest.svg" alt="" width={64} height={64} style={{ opacity: 0.9, marginTop: 4 }} />
      </div>

      <div className="screen" style={{ gap: 14 }}>
        {claimedTotal === 0 ? (
          <div className="card empty-block" style={{ textAlign: "center" }}>
            <div className="empty-lead">Fresh booklet.</div>
            <div className="empty-sub">
              Pour a country beer during their match to stamp it.
            </div>
          </div>
        ) : null}

        {claimed.length > 0 ? (
          <div>
            <div className="section-label">
              <span className="caps-label">In progress · {claimed.length}</span>
              <span className="t-small muted">Most recent first</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {claimed.map((p) => (
                <CountryStampCard key={p.code} progress={p} />
              ))}
            </div>
          </div>
        ) : null}

        {unclaimed.length > 0 ? (
          <div>
            <div className="section-label">
              <span className="caps-label">Untouched · {unclaimed.length}</span>
              <span className="t-small muted">Tap to see beers</span>
            </div>
            <div className="unclaimed-grid">
              {unclaimed.map((p) => (
                <Link
                  key={p.code}
                  href={`/team/${p.code}`}
                  className="unclaimed-cell"
                  aria-label={p.name}
                  title={p.name}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span className="uc-flag" aria-hidden>{flag(p.code)}</span>
                  <span className="uc-name">{p.name}</span>
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

function CountryStampCard({ progress }: { progress: CountryProgress }) {
  const accent = colorFor(progress.code);
  const allBeers = COUNTRY_BEERS[progress.code] ?? [];
  const pct = progress.totalBeers === 0 ? 0 : Math.round((progress.claimedBeers / progress.totalBeers) * 100);

  return (
    <Link
      href={`/team/${progress.code}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        background: `linear-gradient(${accent.tint}, ${accent.tint}), var(--foam-lit)`,
        border: `1.5px solid ${accent.primary}`,
        borderLeft: `4px solid ${accent.primary}`,
        borderRadius: "var(--r-md)",
        padding: "12px 14px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "var(--foam-lit)",
            border: `2px solid ${accent.primary}`,
            display: "grid",
            placeItems: "center",
            fontSize: 24,
            lineHeight: 1,
            flex: "0 0 44px",
          }}
        >
          {FLAG_EMOJI[progress.code] ?? ""}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-sub" style={{ fontSize: 16 }}>{progress.name}</div>
          <div className="t-small muted">
            {progress.claimedBeers} / {progress.totalBeers} stamps · {progress.pours} pour
            {progress.pours === 1 ? "" : "s"}
            {progress.mostRecentAt ? (
              <> · last <LocalTime iso={progress.mostRecentAt} mode="dateShort" /></>
            ) : null}
          </div>
        </div>
        <span
          style={{
            background: accent.primary,
            color: readableInk(accent.primary),
            padding: "4px 10px",
            borderRadius: 999,
            fontFamily: "var(--ff-display)",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: "-0.01em",
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Mini-stamp grid */}
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: `repeat(${Math.min(6, Math.max(allBeers.length, 1))}, 1fr)`,
          gap: 8,
        }}
      >
        {allBeers.map((b) => {
          const s = progress.stampsByLabel.get(b.name);
          const claimed = !!s;
          return (
            <div
              key={b.name}
              title={b.name + (claimed ? ` · ${s!.count}× since ${shortDate(s!.firstAt)}` : " · unclaimed")}
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: "50%",
                border: `1.5px ${claimed ? "solid" : "dashed"} ${claimed ? accent.primary : "var(--stout-35)"}`,
                background: claimed ? accent.tint2 : "transparent",
                display: "grid",
                placeItems: "center",
                opacity: claimed ? 1 : 0.6,
              }}
            >
              <div style={{ transform: "scale(0.8)" }}>
                <CountryBottle countryCode={progress.code} flag={FLAG_EMOJI[progress.code] ?? ""} size={32} />
              </div>
              {claimed && s!.count > 1 ? (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: accent.accent,
                    color: readableInk(accent.accent),
                    border: "1.5px solid #1C140C",
                    borderRadius: 999,
                    fontFamily: "var(--ff-display)",
                    fontWeight: 800,
                    fontSize: 10,
                    padding: "1px 5px",
                  }}
                  aria-hidden
                >
                  ×{s!.count}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </Link>
  );
}
