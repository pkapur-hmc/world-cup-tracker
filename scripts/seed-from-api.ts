/**
 * Seed wc_teams and wc_matches from football-data.org.
 * One-shot: run after schema is applied, before/after kickoff is fine.
 *
 * Usage:
 *   npm run seed:api
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_API_KEY.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  fetchAllMatches,
  teamsFromMatches,
  toMatchRow,
} from "../lib/football-data";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !FD_KEY) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_API_KEY.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("Fetching WC fixture from football-data.org...");
  const fdMatches = await fetchAllMatches(FD_KEY!);
  console.log(`  got ${fdMatches.length} matches`);

  const teams = teamsFromMatches(fdMatches);
  console.log(`Upserting ${teams.length} teams...`);
  const { error: teamsErr } = await supabase
    .from("wc_teams")
    .upsert(teams, { onConflict: "code" });
  if (teamsErr) {
    console.error("Teams upsert failed:", teamsErr);
    process.exit(1);
  }

  const matches = fdMatches.map(toMatchRow);
  console.log(`Upserting ${matches.length} matches...`);
  const { error: matchesErr } = await supabase
    .from("wc_matches")
    .upsert(matches, { onConflict: "id" });
  if (matchesErr) {
    console.error("Matches upsert failed:", matchesErr);
    process.exit(1);
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
