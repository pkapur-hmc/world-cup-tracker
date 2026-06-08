/**
 * Backfill wc_matches.venue from the Kaggle FIFA WC 2026 dataset.
 *
 *   areezvisram12/fifa-world-cup-2026-match-data-unofficial
 *
 * Drop the dataset's CSVs at data/raw/kaggle-dump/:
 *   - matches.csv      (id, match_number, kickoff_at, home_team_id, away_team_id, city_id, stage_id, match_label)
 *   - host_cities.csv  (id, city_name, country, venue_name, region_cluster, airport_code)
 *   - teams.csv        (id, team_name, fifa_code, group_letter, is_placeholder)
 *   - tournament_stages.csv
 *
 * Then: npm run import:venues
 *
 * Matching strategy:
 *   Build a (team_a, team_b) set key from each Kaggle group-stage match that
 *   has two real teams (54 rows), look up the corresponding DB match. For
 *   knockout matches both sides are TBD until later rounds, so we line them
 *   up by (stage, kickoff order within stage). Kaggle TLAs sometimes differ
 *   from football-data's (URU vs URY) so we apply a small alias map.
 *
 *   Why not by timestamp: Kaggle's kickoff_at is off by 1-4 hours for ~60%
 *   of matches vs FIFA's published schedule (verified via fifa.com), so we
 *   trust football-data for times and Kaggle only for venue.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAW_DIR = join(process.cwd(), "data/raw/kaggle-dump");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function parseCsv(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { cur.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.length > 1 || cur[0] !== "") lines.push(cur);
      cur = [];
    } else field += c;
  }
  if (field !== "" || cur.length > 0) {
    cur.push(field);
    if (cur.length > 1 || cur[0] !== "") lines.push(cur);
  }
  const [header, ...rows] = lines;
  return rows.map((r) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])),
  );
}

function loadCsv(name: string): Record<string, string>[] {
  try {
    return parseCsv(readFileSync(join(RAW_DIR, name), "utf8"));
  } catch {
    console.error(`Missing ${join(RAW_DIR, name)}`);
    process.exit(1);
  }
}

/** Kaggle uses a couple of FIFA TLAs that diverge from football-data's. */
const TLA_ALIAS: Record<string, string> = {
  URU: "URY", // Uruguay
  CUR: "CUW", // Curaçao (older code)
};
function normTla(t: string | undefined | null): string {
  if (!t) return "";
  return TLA_ALIAS[t] ?? t;
}
function pairKey(a: string | null | undefined, b: string | null | undefined): string {
  return [normTla(a), normTla(b)].sort().join("|");
}

const STAGE_KAGGLE_TO_DB: Record<string, string> = {
  "1": "group",
  "2": "r32",
  "3": "r16",
  "4": "qf",
  "5": "sf",
  "6": "third_place",
  "7": "final",
};

async function main() {
  const matches = loadCsv("matches.csv");
  const cities = loadCsv("host_cities.csv");
  const teams = loadCsv("teams.csv");

  const cityById = new Map(cities.map((c) => [c.id, c]));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: dbMatches, error } = await supabase
    .from("wc_matches")
    .select("id,kickoff_at,team_a_code,team_b_code,venue,stage")
    .order("kickoff_at")
    .order("id");
  if (error) throw error;

  // ---- Pass 1: group stage by team pair ----
  const dbByPair = new Map<string, typeof dbMatches[number]>();
  for (const r of dbMatches!) {
    if (r.team_a_code && r.team_b_code) {
      dbByPair.set(pairKey(r.team_a_code, r.team_b_code), r);
    }
  }

  const venueFor = (k: Record<string, string>): string | null => {
    const c = cityById.get(k.city_id);
    return c ? `${c.venue_name}, ${c.city_name}` : null;
  };

  type Assignment = { dbId: number; venue: string; via: string };
  const assignments: Assignment[] = [];
  const usedDbIds = new Set<number>();
  const unmatched: { matchNo: string; reason: string }[] = [];

  for (const k of matches) {
    const kHome = teamById.get(k.home_team_id);
    const kAway = teamById.get(k.away_team_id);
    const venue = venueFor(k);
    if (!venue) { unmatched.push({ matchNo: k.match_number, reason: "no city" }); continue; }

    // Group-stage real-team match: pair lookup.
    if (
      kHome?.is_placeholder === "False" &&
      kAway?.is_placeholder === "False" &&
      STAGE_KAGGLE_TO_DB[k.stage_id] === "group"
    ) {
      const dbRow = dbByPair.get(pairKey(kHome.fifa_code, kAway.fifa_code));
      if (dbRow) {
        assignments.push({ dbId: dbRow.id, venue, via: "pair" });
        usedDbIds.add(dbRow.id);
        continue;
      }
    }
    unmatched.push({ matchNo: k.match_number, reason: "deferred-to-stage-pos" });
  }

  // ---- Pass 2: align remaining Kaggle rows to remaining DB rows by (stage, position) ----
  // For each stage, take leftover Kaggle rows in match_number order and
  // leftover DB rows in (kickoff_at, id) order, line them up 1:1.
  const remainingKaggle = matches
    .filter((k) => {
      const venue = venueFor(k);
      if (!venue) return false;
      const kHome = teamById.get(k.home_team_id);
      const kAway = teamById.get(k.away_team_id);
      const isGroupRealPair =
        kHome?.is_placeholder === "False" &&
        kAway?.is_placeholder === "False" &&
        STAGE_KAGGLE_TO_DB[k.stage_id] === "group" &&
        dbByPair.has(pairKey(kHome.fifa_code, kAway.fifa_code));
      return !isGroupRealPair;
    })
    .sort((a, b) => Number(a.match_number) - Number(b.match_number));

  const remainingDb = dbMatches!.filter((r) => !usedDbIds.has(r.id));

  // Bucket by stage
  const byStageDb = new Map<string, typeof dbMatches>();
  for (const r of remainingDb) {
    const arr = byStageDb.get(r.stage) ?? [];
    arr.push(r);
    byStageDb.set(r.stage, arr);
  }
  const byStageKaggle = new Map<string, Record<string, string>[]>();
  for (const k of remainingKaggle) {
    const dbStage = STAGE_KAGGLE_TO_DB[k.stage_id];
    const arr = byStageKaggle.get(dbStage) ?? [];
    arr.push(k);
    byStageKaggle.set(dbStage, arr);
  }

  for (const [stage, kArr] of byStageKaggle) {
    const dArr = byStageDb.get(stage) ?? [];
    if (kArr.length !== dArr.length) {
      console.warn(
        `stage ${stage}: kaggle leftover=${kArr.length} db leftover=${dArr.length}`,
      );
    }
    const n = Math.min(kArr.length, dArr.length);
    for (let i = 0; i < n; i++) {
      const venue = venueFor(kArr[i])!;
      assignments.push({ dbId: dArr[i].id, venue, via: `stage:${stage}#${i + 1}` });
      usedDbIds.add(dArr[i].id);
    }
  }

  console.log(`Assignments: ${assignments.length}/${matches.length}`);
  const byVia = assignments.reduce(
    (a, x) => {
      const k = x.via.startsWith("stage:") ? "stage-position" : x.via;
      a[k] = (a[k] ?? 0) + 1;
      return a;
    },
    {} as Record<string, number>,
  );
  console.log("Match strategies:", byVia);
  if (unmatched.length) console.log("Unmatched:", unmatched.slice(0, 5));

  let updated = 0;
  let alreadySet = 0;
  const dbById = new Map(dbMatches!.map((r) => [r.id, r]));
  for (const a of assignments) {
    const existing = dbById.get(a.dbId)!;
    if (existing.venue === a.venue) { alreadySet++; continue; }
    const { error: upErr } = await supabase
      .from("wc_matches")
      .update({ venue: a.venue })
      .eq("id", a.dbId);
    if (upErr) throw upErr;
    updated++;
  }
  console.log(JSON.stringify({ updated, alreadySet, totalCovered: assignments.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
