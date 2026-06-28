/**
 * READ-ONLY verification + preview for the comeback multiplier (#6) and soft
 * reset (#9). Safe to run against the live DB - it never writes.
 *
 *   npx tsx scripts/verify-multiplier.ts
 *
 * It:
 *   1. reports whether scripts/010+ have been applied and the flag state,
 *   2. recomputes every player's WCC the same way the app does (derived base +
 *      comeback bonuses + adjustments) and checks it against the wc_user_scores
 *      snapshot - flagging any drift,
 *   3. previews the discrete multiplier each player would get vs the leader,
 *   4. previews what apply_knockout_compression(0.4) WOULD do (no write).
 *
 * The write-path RPCs (log_pour, settle, the reset itself) are auth-scoped, so
 * verify those in the app UI on a TEST match (ids 900001-3) after applying SQL.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { wccTotal, type DrinkRow, type PickRow } from "../lib/scoring";

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

const COUNTRY_BASE = 2;
const RESET_FACTOR = 0.4;

// discrete tiers - must mirror scripts/010 wc_refresh_user_scores exactly
function tiers(score: number, leader: number) {
  if (leader <= 0) return { beer: 1, passport: 1, stake: 1 };
  const ratio = Math.max(0, Math.min(1, 1 - score / leader));
  return {
    beer: Math.max(1, Math.min(10, Math.round(1 + 9 * ratio))),
    passport: 1 + Math.round(8 * ratio) / 2,
    stake: 1 + Math.round(10 * ratio) / 10,
  };
}

const pageAll = async (tbl: string, cols: string) => {
  let out: Record<string, unknown>[] = [];
  let from = 0;
  const size = 1000;
  for (;;) {
    const { data, error } = await sb.from(tbl).select(cols).range(from, from + size - 1);
    if (error) return { rows: out, error };
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    out = out.concat(rows);
    if (rows.length < size) break;
    from += size;
  }
  return { rows: out, error: null };
};

async function main() {
  // ---- 1. migration / flag status ----
  const settings = await sb.from("wc_settings").select("key, value").eq("key", "multiplier_enabled");
  const applied = !settings.error;
  console.log("=== status ===");
  console.log("scripts/010+ applied:", applied ? "yes" : "NO (new tables absent)");
  if (applied) {
    console.log("multiplier_enabled:", settings.data?.[0]?.value ?? "(unset)");
  }

  // ---- 2. recompute every player's WCC (derived base + extras) ----
  const members = await pageAll("wc_memberships", "user_id");
  const userIds = Array.from(new Set((members.rows as { user_id: string }[]).map((m) => m.user_id)));

  const drinks = await pageAll("wc_drinks", "user_id, match_id, country_code, beer_label");
  const picks = await pageAll("wc_picks", "user_id, match_id, pick, stake, settled_at, payout_wcc, payout_wcp");
  const cb = applied ? await pageAll("wc_comeback_bonus", "user_id, bonus_wcc") : { rows: [], error: null };
  const adj = applied ? await pageAll("wc_score_adjustments", "user_id, delta") : { rows: [], error: null };

  const drinksByUser = new Map<string, DrinkRow[]>();
  for (const d of drinks.rows as ({ user_id: string } & DrinkRow)[]) {
    const a = drinksByUser.get(d.user_id) ?? [];
    a.push({ match_id: d.match_id, country_code: d.country_code, beer_label: d.beer_label });
    drinksByUser.set(d.user_id, a);
  }
  const picksByUser = new Map<string, PickRow[]>();
  for (const p of picks.rows as ({ user_id: string } & PickRow)[]) {
    const a = picksByUser.get(p.user_id) ?? [];
    a.push({ match_id: p.match_id, pick: p.pick, stake: p.stake, settled_at: p.settled_at, payout_wcc: p.payout_wcc, payout_wcp: p.payout_wcp });
    picksByUser.set(p.user_id, a);
  }
  const extraByUser = new Map<string, number>();
  for (const r of cb.rows as { user_id: string; bonus_wcc: number }[])
    extraByUser.set(r.user_id, (extraByUser.get(r.user_id) ?? 0) + Number(r.bonus_wcc));
  for (const r of adj.rows as { user_id: string; delta: number }[])
    extraByUser.set(r.user_id, (extraByUser.get(r.user_id) ?? 0) + Number(r.delta));

  const scores = userIds
    .map((u) => {
      const base = wccTotal(drinksByUser.get(u) ?? [], picksByUser.get(u) ?? []);
      const extra = extraByUser.get(u) ?? 0;
      return { u, base, extra, total: base + extra };
    })
    .sort((a, b) => b.total - a.total);
  const leader = scores.length ? scores[0].total : 0;

  // ---- 3. snapshot consistency + multiplier preview ----
  const snap = applied ? await pageAll("wc_user_scores", "user_id, wcc, beer_mult, passport_mult, stake_mult") : { rows: [] };
  const snapByUser = new Map<string, { wcc: number; beer_mult: number; passport_mult: number; stake_mult: number }>();
  for (const r of snap.rows as { user_id: string; wcc: number; beer_mult: number; passport_mult: number; stake_mult: number }[])
    snapByUser.set(r.user_id, r);

  console.log("\n=== scores + multipliers (leader = " + leader + ") ===");
  console.log("total  base+extra  beer×(beerWCC)  passp×  stake×   snapshot-wcc  drift");
  let drifts = 0;
  for (const s of scores) {
    const t = tiers(s.total, leader);
    const snapRow = snapByUser.get(s.u);
    const snapWcc = snapRow ? Number(snapRow.wcc) : null;
    const drift = snapWcc !== null && snapWcc !== s.total;
    if (drift) drifts++;
    console.log(
      `${String(s.total).padStart(5)}  ${String(s.base).padStart(4)}+${String(s.extra).padStart(3)}` +
        `   ${String(t.beer).padStart(2)}× (${t.beer * COUNTRY_BASE})` +
        `      ${String(t.passport).padStart(3)}×  ${t.stake.toFixed(1)}×` +
        `    ${snapWcc === null ? "  -" : String(snapWcc).padStart(5)}     ${drift ? "DRIFT!" : "ok"}`,
    );
  }
  if (applied) console.log(drifts === 0 ? "\nsnapshot consistent ✓" : `\n${drifts} snapshot drift(s) - run wc_refresh_user_scores(null)`);

  // ---- 4. soft-reset preview (read-only) ----
  const mean = scores.length ? scores.reduce((a, s) => a + s.total, 0) / scores.length : 0;
  console.log(`\n=== knockout reset preview (factor ${RESET_FACTOR}, mean ${mean.toFixed(0)}) ===`);
  console.log("old -> new  (delta)");
  for (const s of scores) {
    const nw = s.total > mean ? Math.round(mean + (s.total - mean) * RESET_FACTOR) : s.total;
    if (nw !== s.total) console.log(`${String(s.total).padStart(5)} -> ${String(nw).padStart(5)}  (${nw - s.total})`);
  }
  console.log("(players at/below mean unchanged - omitted)");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
