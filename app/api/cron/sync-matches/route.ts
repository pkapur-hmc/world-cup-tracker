/**
 * GET /api/cron/sync-matches
 *
 * Fetches the full WC fixture and upserts status/score changes into wc_matches.
 * Vercel Cron triggers this with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Why fetch all 104 in one call: football-data returns the whole competition
 * in a single ~90KB response, well under the 10 req/min free-tier ceiling.
 * Filtering server-side would cost more calls (one per status filter) and
 * still miss matches that flipped state since the last tick.
 */
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllMatches,
  teamsFromMatches,
  toMatchRow,
} from "@/lib/football-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  const fdKey = process.env.FOOTBALL_DATA_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!fdKey || !supabaseUrl || !serviceKey) {
    return Response.json({ error: "missing env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startedAt = Date.now();
  const fdMatches = await fetchAllMatches(fdKey);

  // Teams first so match FKs resolve when a knockout slot fills in.
  const teams = teamsFromMatches(fdMatches);
  const { error: teamsErr } = await supabase
    .from("wc_teams")
    .upsert(teams, { onConflict: "code" });
  if (teamsErr) {
    return Response.json(
      { error: "teams upsert failed", detail: teamsErr.message },
      { status: 500 },
    );
  }

  const matchRows = fdMatches.map(toMatchRow);
  const { error: matchesErr } = await supabase
    .from("wc_matches")
    .upsert(matchRows, { onConflict: "id" });
  if (matchesErr) {
    return Response.json(
      { error: "matches upsert failed", detail: matchesErr.message },
      { status: 500 },
    );
  }

  // ---- Settle picks ----
  // For every match now `final`, settle any picks still unsettled.
  // For every match now `postponed`, refund any picks still unsettled.
  // RPCs are idempotent (they only touch rows where settled_at IS NULL).
  const finalIds = matchRows.filter((r) => r.status === "final").map((r) => r.id);
  const postponedIds = matchRows
    .filter((r) => r.status === "postponed")
    .map((r) => r.id);

  let settled = 0;
  let refunded = 0;
  for (const id of finalIds) {
    const { data, error } = await supabase.rpc("settle_match_picks", {
      target_match_id: id,
    });
    if (!error && typeof data === "number") settled += data;
  }
  for (const id of postponedIds) {
    const { data, error } = await supabase.rpc("refund_match_picks", {
      target_match_id: id,
    });
    if (!error && typeof data === "number") refunded += data;
  }

  return Response.json({
    ok: true,
    teams: teams.length,
    matches: matchRows.length,
    picks_settled: settled,
    picks_refunded: refunded,
    elapsed_ms: Date.now() - startedAt,
  });
}
