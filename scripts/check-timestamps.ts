import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await s
    .from("wc_matches")
    .select("id,stage,group_letter,team_a_code,team_b_code,kickoff_at")
    .order("kickoff_at");
  if (error) throw error;
  const rows = data!;

  // boundaries
  const first = rows[0];
  const last = rows[rows.length - 1];
  console.log("FIRST:", first);
  console.log("LAST: ", last);

  // distribution by date
  const byDate: Record<string, number> = {};
  for (const r of rows) {
    const day = r.kickoff_at.slice(0, 10);
    byDate[day] = (byDate[day] ?? 0) + 1;
  }
  console.log("\nMatches per day (UTC):");
  for (const [day, n] of Object.entries(byDate)) {
    console.log(`  ${day}: ${n}`);
  }

  // distribution by stage
  const stageRanges: Record<string, { first: string; last: string; n: number }> = {};
  for (const r of rows) {
    const e = stageRanges[r.stage];
    if (!e) {
      stageRanges[r.stage] = { first: r.kickoff_at, last: r.kickoff_at, n: 1 };
    } else {
      e.n++;
      e.last = r.kickoff_at;
    }
  }
  console.log("\nStage date ranges:");
  for (const [stage, e] of Object.entries(stageRanges)) {
    console.log(`  ${stage.padEnd(12)} n=${e.n}  ${e.first} -> ${e.last}`);
  }

  // anomalies
  const tooEarly = rows.filter((r) => r.kickoff_at < "2026-06-11T00:00:00Z");
  const tooLate = rows.filter((r) => r.kickoff_at > "2026-07-19T23:59:59Z");
  console.log("\nOut-of-tournament-window:", { tooEarly: tooEarly.length, tooLate: tooLate.length });

  // print all opener-day and final-day matches
  console.log("\nOpener day (2026-06-11):");
  for (const r of rows.filter((r) => r.kickoff_at.startsWith("2026-06-11"))) {
    console.log(`  ${r.kickoff_at}  ${r.team_a_code ?? "TBD"} v ${r.team_b_code ?? "TBD"}  [${r.stage} ${r.group_letter ?? ""}]`);
  }
  console.log("\nFinal day (2026-07-19):");
  for (const r of rows.filter((r) => r.kickoff_at.startsWith("2026-07-19"))) {
    console.log(`  ${r.kickoff_at}  ${r.team_a_code ?? "TBD"} v ${r.team_b_code ?? "TBD"}  [${r.stage}]`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
