/**
 * Re-honor the voided RSA v CAN (537417) bets under the live 017 curve (Scenario 3).
 *
 * The picks were voided to stake 0 last session, then the 9am cron settled them at +1 each.
 * This corrects that: un-settle the 10 picks, restore each original stake CAPPED at the
 * player's current (post-reset) WCC, snapshot their live 017 stake_mult (current score vs
 * current leader), and re-settle through the production settle_match_picks RPC.
 *
 * Run AFTER 017 is applied (so wc_user_scores.stake_mult is the floored curve).
 * Idempotent-ish: re-running recomputes from the backup + live scores.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MID = 537417;
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const backup = JSON.parse(readFileSync("scripts/537417-void-backup.json", "utf8"));
const origStake = Object.fromEntries(backup.picks.map((p) => [p.user_id, p.stake]));

const { data: mem } = await sb.from("wc_memberships").select("user_id,display_name");
const nm = Object.fromEntries((mem || []).map((m) => [m.user_id, m.display_name]));

// 1. un-settle the 10 picks (clear the +1 cron settlement)
{
  const { error } = await sb
    .from("wc_picks")
    .update({ settled_at: null, payout_wcp: 0, payout_wcc: 0 })
    .eq("match_id", MID);
  if (error) throw new Error("un-settle failed: " + error.message);
}
// 2. refresh so scores drop back to pre-this-settlement
await sb.rpc("wc_refresh_user_scores");

// 3. read current wcc + live (017) stake_mult per bettor
const { data: picks } = await sb.from("wc_picks").select("user_id,pick,stake,stake_mult").eq("match_id", MID);
const { data: scores } = await sb.from("wc_user_scores").select("user_id,wcc,stake_mult");
const sc = Object.fromEntries((scores || []).map((s) => [s.user_id, s]));

console.log("=== restoring (cap = min(orig stake, current WCC); mult = live 017) ===");
for (const p of picks) {
  const s = sc[p.user_id] || { wcc: 0, stake_mult: 1.0 };
  const orig = origStake[p.user_id] ?? 0;
  const capped = Math.min(orig, Number(s.wcc));
  const mult = Number(s.stake_mult);
  const { error } = await sb
    .from("wc_picks")
    .update({ stake: capped, stake_mult: mult })
    .eq("match_id", MID)
    .eq("user_id", p.user_id);
  if (error) throw new Error(`update ${p.user_id} failed: ${error.message}`);
  const cap = orig !== capped ? ` (capped from ${orig})` : "";
  console.log(`  ${(nm[p.user_id] || "?").padEnd(16)} stake=${capped}${cap} mult=${mult}`);
}

// 4. settle through production RPC, then refresh
{
  const { data, error } = await sb.rpc("settle_match_picks", { target_match_id: MID });
  if (error) throw new Error("settle failed: " + error.message);
  console.log("\nsettled rows:", data);
}
await sb.rpc("wc_refresh_user_scores");

// 5. verify
const { data: after } = await sb.from("wc_picks").select("user_id,stake,stake_mult,payout_wcp,settled_at").eq("match_id", MID);
const { data: finalScores } = await sb.from("wc_user_scores").select("user_id,wcc").order("wcc", { ascending: false });
const fs = Object.fromEntries((finalScores || []).map((s) => [s.user_id, s.wcc]));
console.log("\n=== settled payouts + final standings ===");
for (const a of after.sort((x, y) => Number(y.payout_wcp) - Number(x.payout_wcp))) {
  console.log(
    `  ${(nm[a.user_id] || "?").padEnd(16)} stake=${a.stake} mult=${a.stake_mult} payout=${a.payout_wcp} settled=${!!a.settled_at} | WCC=${fs[a.user_id]}`,
  );
}
console.log("\nTop 3:", (finalScores || []).slice(0, 3).map((s) => `${nm[s.user_id]}=${s.wcc}`).join(", "));
const negative = (finalScores || []).filter((s) => Number(s.wcc) < 0);
console.log("negative balances:", negative.length === 0 ? "none ✓" : JSON.stringify(negative));
