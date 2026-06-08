"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PourArgs = {
  matchId: number | null;
  countryCode?: string;
  beerLabel?: string;
};

/** Log a single WCC. Optionally attach to a live match + country-beer. */
export async function pourAction(args: PourArgs): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: m } = await supabase
    .from("wc_memberships")
    .select("group_id")
    .eq("user_id", user.id)
    .limit(1);
  const groupId = (m?.[0] as { group_id: string } | undefined)?.group_id;
  if (!groupId) return { error: "no group" };

  const row: Record<string, unknown> = {
    group_id: groupId,
    user_id: user.id,
    drink_type: "beer",
  };
  if (args.matchId != null) row.match_id = args.matchId;
  if (args.countryCode) row.country_code = args.countryCode;
  if (args.beerLabel) row.beer_label = args.beerLabel;

  const { error } = await supabase.from("wc_drinks").insert(row);
  if (error) return { error: error.message };

  if (args.matchId != null) revalidatePath(`/match/${args.matchId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Delete the user's most recent drink within the 5-minute undo window. */
export async function undoLastPourAction(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: last, error: selErr } = await supabase
    .from("wc_drinks")
    .select("id, match_id")
    .eq("user_id", user.id)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);
  if (selErr) return { error: selErr.message };
  if (!last || last.length === 0) return { error: "nothing recent to undo" };

  const { error: delErr } = await supabase
    .from("wc_drinks")
    .delete()
    .eq("id", (last[0] as { id: string }).id);
  if (delErr) return { error: delErr.message };

  const matchId = (last[0] as { match_id: number | null }).match_id;
  if (matchId != null) revalidatePath(`/match/${matchId}`);
  revalidatePath("/");
  return { ok: true };
}

export type PlacePickArgs = {
  matchId: number;
  pick: "A" | "D" | "B";
  stake: number;
};

/** Place/edit a pick + stake. Server-enforces lock + balance via RPC. */
export async function placePickAction(
  args: PlacePickArgs,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: m } = await supabase
    .from("wc_memberships")
    .select("group_id")
    .eq("user_id", user.id)
    .limit(1);
  const groupId = (m?.[0] as { group_id: string } | undefined)?.group_id;
  if (!groupId) return { error: "no group" };

  const { error } = await supabase.rpc("place_pick", {
    target_group_id: groupId,
    target_match_id: args.matchId,
    pick_value: args.pick,
    stake_value: args.stake,
  });
  if (error) return { error: error.message };

  revalidatePath(`/match/${args.matchId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Ping presence for "watching now" panel. */
export async function watchingPingAction(matchId: number): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: m } = await supabase
    .from("wc_memberships")
    .select("group_id")
    .eq("user_id", user.id)
    .limit(1);
  const groupId = (m?.[0] as { group_id: string } | undefined)?.group_id;
  if (!groupId) return;

  await supabase.from("wc_events").insert({
    group_id: groupId,
    user_id: user.id,
    match_id: matchId,
    kind: "watching",
    payload: {},
  });
}
