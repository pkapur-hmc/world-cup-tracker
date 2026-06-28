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
  fetchMatch,
  teamsFromMatches,
  toMatchRow,
  type FdMatch,
} from "@/lib/football-data";
import { fetchEspnScores } from "@/lib/espn-scoreboard";

/**
 * The bulk feed omits score.fullTime even on FINISHED matches (the detail
 * endpoint has it). Per tick we spend up to this many extra calls fetching
 * details for matches that are in play, or finished with no score on record.
 * 1 bulk + 8 details stays under the 10 req/min free-tier ceiling.
 */
const DETAIL_FETCH_BUDGET = 8;

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
  let fdMatches = await fetchAllMatches(fdKey);

  // Backfill scores the bulk feed left null. Finished-without-a-score first
  // (settlement depends on it), then live matches (so the score shows during
  // the match). A finished match needs at most one detail fetch ever: once
  // its score lands in the DB it no longer qualifies.
  const { data: existingRows } = await supabase
    .from("wc_matches")
    .select("id, status, score_a, score_b, winner_code");
  const dbScores = new Map((existingRows ?? []).map((r) => [r.id, r]));

  const scoreKnown = (id: number) => {
    const ex = dbScores.get(id);
    return !!ex && ex.score_a !== null && ex.score_b !== null;
  };
  const needsDetail = fdMatches
    .filter((m) => m.score.fullTime.home === null)
    .filter(
      (m) =>
        m.status === "IN_PLAY" ||
        m.status === "PAUSED" ||
        ((m.status === "FINISHED" || m.status === "AWARDED") &&
          !scoreKnown(m.id)),
    )
    .sort((a, b) => {
      const aLive = a.status === "IN_PLAY" || a.status === "PAUSED";
      const bLive = b.status === "IN_PLAY" || b.status === "PAUSED";
      return Number(aLive) - Number(bLive); // finished first
    })
    .slice(0, DETAIL_FETCH_BUDGET);

  const details = await Promise.all(
    needsDetail.map((m) =>
      fetchMatch(fdKey, m.id).catch((): FdMatch | null => null),
    ),
  );
  const detailById = new Map(
    details.filter((d): d is FdMatch => d !== null).map((d) => [d.id, d]),
  );
  fdMatches = fdMatches.map((m) => detailById.get(m.id) ?? m);

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

  // football-data serves inconsistent responses (stale replicas): a match
  // can come back TIMED with no score minutes after another response said
  // FINISHED 2-0 (observed on MEX/RSA, opening night). Two guards:
  // 1. Status never regresses: scheduled -> live -> final is one-way.
  //    `postponed` is exempt both directions (suspensions and reschedules
  //    are legitimate back-and-forth).
  // 2. A known score is never clobbered by a null.
  const STATUS_RANK: Record<string, number> = {
    scheduled: 0,
    live: 1,
    final: 2,
  };
  // Stamp every row with this tick's time so updated_at becomes a real
  // "last synced at" (the column has no trigger; default now() only fires on
  // insert). live_minute starts null and is filled by the ESPN overlay below
  // for in-play matches - a row that's no longer live gets null, clearing any
  // stale minute.
  const syncedAtIso = new Date(startedAt).toISOString();
  const matchRows = fdMatches.map((m) => {
    const row = {
      ...toMatchRow(m),
      live_minute: null as string | null,
      updated_at: syncedAtIso,
    };
    const ex = dbScores.get(row.id);
    if (!ex) return row;
    if (
      row.status !== "postponed" &&
      ex.status !== "postponed" &&
      STATUS_RANK[row.status] < STATUS_RANK[ex.status]
    ) {
      row.status = ex.status;
    }
    if (
      row.score_a === null &&
      row.score_b === null &&
      ex.score_a !== null &&
      ex.score_b !== null
    ) {
      row.score_a = ex.score_a;
      row.score_b = ex.score_b;
      row.winner_code = ex.winner_code;
    }
    return row;
  });

  // ---- ESPN live overlay (score + full-time) ----
  // football-data's free tier lags the live game by many minutes even when
  // its lastUpdated looks fresh: in-play scores (KOR/CZE 2026-06-12: ESPN
  // showed 0-1 in the 64' while both football-data endpoints still said 0-0)
  // AND the FINISHED flip (both opening matches sat "live" 10-15min past the
  // final whistle). While a match is not yet final, ESPN's near-real-time
  // score wins; when ESPN reports full time, the row flips to `final` so the
  // app ends the match within a tick of the real whistle.
  //
  // Settlement still belongs to football-data alone: picks only settle once
  // football-data ITSELF says FINISHED (fdFinalIds below), with its official
  // score and winner. An ESPN-finalized row just waits. Overlay is
  // best-effort: if ESPN is down or the fixture doesn't match, the row keeps
  // football-data's numbers.
  let espnOverlays = 0;
  let espnFinals = 0;
  try {
    const espnScores = await fetchEspnScores();
    const FIXTURE_MATCH_WINDOW_MS = 12 * 60 * 60 * 1000;
    for (const row of matchRows) {
      if (row.status === "final" || !row.team_a_code || !row.team_b_code) {
        continue;
      }
      const kickoff = Date.parse(row.kickoff_at);
      const ev = espnScores.find(
        (s) =>
          Math.abs(s.kickoffMs - kickoff) < FIXTURE_MATCH_WINDOW_MS &&
          ((s.homeCode === row.team_a_code && s.awayCode === row.team_b_code) ||
            (s.homeCode === row.team_b_code && s.awayCode === row.team_a_code)),
      );
      if (!ev) continue;
      const swapped = ev.homeCode === row.team_b_code;
      const a = swapped ? ev.awayScore : ev.homeScore;
      const b = swapped ? ev.homeScore : ev.awayScore;
      if (row.score_a !== a || row.score_b !== b) {
        row.score_a = a;
        row.score_b = b;
        espnOverlays++;
      }
      // Capture the in-play clock so the match page can show "64' · synced Nm
      // ago". Only while still in play; a finished row keeps it null.
      if (ev.state === "in" && ev.minute) {
        row.live_minute = ev.minute;
      }
      if (ev.state === "post" && row.status !== "postponed") {
        row.status = "final";
        // Winner from the ESPN final score so the post-match UI reads right
        // while we wait for football-data; its official result overwrites
        // this when it lands.
        row.winner_code =
          a > b ? row.team_a_code : b > a ? row.team_b_code : null;
        espnFinals++;
      }
    }
  } catch {
    // overlay is optional; the football-data sync still lands
  }

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
  // Two settlement gates, both required:
  // 1. football-data ITSELF must say FINISHED this tick (not just the row
  //    status, which ESPN full-time or a previous tick may have set) - picks
  //    pay out on the official result only.
  // 2. A real score must be in hand: final with null scores is
  //    indistinguishable from a draw inside the RPC (winner_code null), which
  //    is exactly how MEX/RSA paid every Mexico pick 0 on opening night.
  const fdFinalIds = new Set(
    fdMatches
      .filter((m) => m.status === "FINISHED" || m.status === "AWARDED")
      .map((m) => m.id),
  );
  const finalIds = matchRows
    .filter(
      (r) =>
        fdFinalIds.has(r.id) &&
        r.status === "final" &&
        r.score_a !== null &&
        r.score_b !== null,
    )
    .map((r) => r.id);
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

  // Refresh the comeback-multiplier snapshot once per tick: settlements move
  // scores, which re-anchors everyone's multiplier. Best-effort + idempotent;
  // a no-op (just recompute) if the multiplier feature isn't live yet. Tolerant
  // of the RPC not existing before scripts/010 is applied.
  await supabase.rpc("wc_refresh_user_scores", { targets: null });

  return Response.json({
    ok: true,
    teams: teams.length,
    matches: matchRows.length,
    detail_fetches: needsDetail.length,
    espn_overlays: espnOverlays,
    espn_finals: espnFinals,
    picks_settled: settled,
    picks_refunded: refunded,
    elapsed_ms: Date.now() - startedAt,
  });
}
