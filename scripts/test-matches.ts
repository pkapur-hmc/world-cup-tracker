/**
 * Test-match harness. Lets you walk the full flow before kickoff
 * without polluting real WC fixture data.
 *
 * Test matches live in id range 900000+ so they can't collide with
 * football-data's 537xxx ids. The cron only upserts ids it gets back
 * from the API, so it'll leave these alone.
 *
 * Usage:
 *   npm run test:matches -- seed
 *   npm run test:matches -- cycle 900002 live           # set status
 *   npm run test:matches -- cycle 900002 final 2 1 MEX  # status + score + winner
 *   npm run test:matches -- reset                       # nuke all test data
 *   npm run test:matches -- list                        # show what's in the DB
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const s = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TEST_ID_FLOOR = 900000;

type TestMatch = {
  id: number;
  stage: "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";
  group_letter: string | null;
  team_a_code: string;
  team_b_code: string;
  kickoff_at: string;
  venue: string | null;
  status: "scheduled" | "live" | "final" | "postponed";
  score_a: number | null;
  score_b: number | null;
  winner_code: string | null;
};

function isoMinutesFromNow(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

const TEST_MATCHES: TestMatch[] = [
  {
    id: 900001,
    stage: "group",
    group_letter: "A",
    team_a_code: "MEX",
    team_b_code: "ARG",
    kickoff_at: isoMinutesFromNow(15), // 15 min from now - you can still pick
    venue: "TEST Stadium - pickable",
    status: "scheduled",
    score_a: null,
    score_b: null,
    winner_code: null,
  },
  {
    id: 900002,
    stage: "group",
    group_letter: "B",
    team_a_code: "BRA",
    team_b_code: "GER",
    kickoff_at: isoMinutesFromNow(-30), // started 30 min ago
    venue: "TEST Stadium - live now",
    status: "live",
    score_a: 1,
    score_b: 0,
    winner_code: null,
  },
  {
    id: 900003,
    stage: "group",
    group_letter: "C",
    team_a_code: "USA",
    team_b_code: "ESP",
    kickoff_at: isoMinutesFromNow(-180), // finished 2h ago
    venue: "TEST Stadium - final",
    status: "final",
    score_a: 2,
    score_b: 1,
    winner_code: "USA",
  },
];

async function seed() {
  console.log(`Upserting ${TEST_MATCHES.length} test matches (ids ${TEST_ID_FLOOR}+)...`);
  const { error } = await s.from("wc_matches").upsert(TEST_MATCHES, { onConflict: "id" });
  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
  for (const m of TEST_MATCHES) {
    console.log(`  ${m.id}  ${m.status.padEnd(10)}  ${m.team_a_code} ${m.score_a ?? "-"} - ${m.score_b ?? "-"} ${m.team_b_code}  (${m.venue})`);
  }
  console.log("Done. Open the app to walk the flow.");
}

async function cycle(args: string[]) {
  const [idStr, status, scoreA, scoreB, winner] = args;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < TEST_ID_FLOOR) {
    console.error(`First arg must be a test match id (>= ${TEST_ID_FLOOR}). Got: ${idStr}`);
    process.exit(1);
  }
  if (!["scheduled", "live", "final", "postponed"].includes(status)) {
    console.error(`Status must be scheduled / live / final / postponed. Got: ${status}`);
    process.exit(1);
  }
  const update: Record<string, unknown> = { status };
  if (scoreA !== undefined) update.score_a = Number(scoreA);
  if (scoreB !== undefined) update.score_b = Number(scoreB);
  if (winner !== undefined) update.winner_code = winner === "draw" ? null : winner;

  // If flipping to live: align kickoff_at to ~30 min ago so countdowns make sense
  if (status === "live") update.kickoff_at = isoMinutesFromNow(-30);
  if (status === "scheduled") update.kickoff_at = isoMinutesFromNow(15);
  if (status === "final" && scoreA === undefined) {
    // make sure there's a winner if going to final
    update.score_a = 1;
    update.score_b = 0;
  }

  console.log(`Updating match ${id}:`, update);
  const { error } = await s.from("wc_matches").update(update).eq("id", id);
  if (error) {
    console.error("Update failed:", error.message);
    process.exit(1);
  }

  // If newly final, run settlement on existing picks for this match
  if (status === "final") {
    const { data, error: rpcErr } = await s.rpc("settle_match_picks", { target_match_id: id });
    if (rpcErr) {
      console.error("Settlement RPC failed:", rpcErr.message);
    } else {
      console.log(`Settled ${data} pick(s) for match ${id}.`);
    }
  }
  if (status === "postponed") {
    const { data, error: rpcErr } = await s.rpc("refund_match_picks", { target_match_id: id });
    if (rpcErr) console.error("Refund RPC failed:", rpcErr.message);
    else console.log(`Refunded ${data} pick(s) for match ${id}.`);
  }
}

async function reset() {
  console.log(`Resetting all test data (match ids >= ${TEST_ID_FLOOR})...`);

  // Order matters: picks have FK to matches without ON DELETE, so picks first.
  const tables = ["wc_picks", "wc_drinks", "wc_events"] as const;
  for (const t of tables) {
    const { error, count } = await s
      .from(t)
      .delete({ count: "exact" })
      .gte("match_id", TEST_ID_FLOOR);
    if (error) {
      console.error(`Failed to clear ${t}:`, error.message);
      process.exit(1);
    }
    console.log(`  ${t.padEnd(12)}  deleted ${count ?? 0} rows`);
  }

  const { error, count } = await s
    .from("wc_matches")
    .delete({ count: "exact" })
    .gte("id", TEST_ID_FLOOR);
  if (error) {
    console.error("Failed to clear test matches:", error.message);
    process.exit(1);
  }
  console.log(`  wc_matches    deleted ${count ?? 0} test rows`);
  console.log("Reset complete. Real fixture data is untouched.");
}

async function list() {
  const { data: matches } = await s
    .from("wc_matches")
    .select("id,stage,group_letter,team_a_code,team_b_code,kickoff_at,status,score_a,score_b,winner_code")
    .gte("id", TEST_ID_FLOOR)
    .order("id");

  console.log(`Test matches (${matches?.length ?? 0}):`);
  for (const m of (matches ?? []) as TestMatch[]) {
    console.log(`  ${m.id}  ${m.status.padEnd(10)}  ${m.team_a_code} ${m.score_a ?? "-"} - ${m.score_b ?? "-"} ${m.team_b_code}  ${m.kickoff_at}`);
  }

  for (const t of ["wc_picks", "wc_drinks", "wc_events"] as const) {
    const { count } = await s
      .from(t)
      .select("*", { count: "exact", head: true })
      .gte("match_id", TEST_ID_FLOOR);
    console.log(`  ${t.padEnd(12)}  ${count ?? 0} rows tied to test matches`);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "seed": await seed(); break;
    case "cycle": await cycle(rest); break;
    case "reset": await reset(); break;
    case "list": await list(); break;
    default:
      console.log("Usage:");
      console.log("  npm run test:matches -- seed");
      console.log("  npm run test:matches -- cycle <id> <scheduled|live|final|postponed> [scoreA] [scoreB] [winnerCode|draw]");
      console.log("  npm run test:matches -- reset");
      console.log("  npm run test:matches -- list");
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
