/**
 * Seed wc_teams and wc_matches from data/*.json into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type TeamRow = {
  code: string;
  name: string;
  flag_emoji: string | null;
  group_letter: string | null;
};

type MatchRow = {
  id: number;
  stage: string;
  group_letter: string | null;
  team_a_code: string | null;
  team_b_code: string | null;
  kickoff_at: string;
  venue: string | null;
};

async function seed() {
  const teamsFile = JSON.parse(
    readFileSync(join(process.cwd(), "data/teams.json"), "utf8"),
  ) as { teams: TeamRow[] };

  const matchesFile = JSON.parse(
    readFileSync(join(process.cwd(), "data/matches.json"), "utf8"),
  ) as { matches: MatchRow[] };

  console.log(`Seeding ${teamsFile.teams.length} teams...`);
  const { error: teamsError } = await supabase
    .from("wc_teams")
    .upsert(teamsFile.teams, { onConflict: "code" });
  if (teamsError) {
    console.error("Teams upsert failed:", teamsError);
    process.exit(1);
  }

  console.log(`Seeding ${matchesFile.matches.length} matches...`);
  const { error: matchesError } = await supabase
    .from("wc_matches")
    .upsert(matchesFile.matches, { onConflict: "id" });
  if (matchesError) {
    console.error("Matches upsert failed:", matchesError);
    process.exit(1);
  }

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
