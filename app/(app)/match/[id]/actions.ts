"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PourArgs = {
  matchId: number | null;
  countryCode?: string;
  beerLabel?: string;
};

/** Log a single drink via the log_pour RPC, which also computes & writes any
 *  comeback-multiplier bonus server-side (clients can't forge an award). */
export async function pourAction(args: PourArgs): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase.rpc("log_pour", {
    target_match_id: args.matchId ?? null,
    target_country: args.countryCode ?? null,
    target_beer: args.beerLabel ?? null,
  });
  if (error) return { error: error.message };

  if (args.matchId != null) revalidatePath(`/match/${args.matchId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Delete the user's most recent BASIC drink for a match (no country / no beer label).
 *  Used by the basic-drink stepper "−1" button. No time window - this is the
 *  user explicitly undoing a tap they regret, not a recency-only safety net. */
export async function undoLastBasicForMatchAction(
  matchId: number,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: last, error: selErr } = await supabase
    .from("wc_drinks")
    .select("id")
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .is("country_code", null)
    .is("beer_label", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (selErr) return { error: selErr.message };
  if (!last || last.length === 0) return { error: "no basic drinks to remove" };

  const { error: delErr } = await supabase.rpc("undo_pour", {
    target_drink_id: (last[0] as { id: string }).id,
  });
  if (delErr) return { error: delErr.message };

  revalidatePath(`/match/${matchId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Delete the user's most recent drink for a specific country-beer in a match.
 *  Used by the country-beer stepper "−" button. No time window - decrementing
 *  a logged beer is always allowed (you logged it, you can remove it). */
export async function undoLastBeerAction(args: {
  matchId: number;
  countryCode: string;
  beerLabel: string;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: last, error: selErr } = await supabase
    .from("wc_drinks")
    .select("id")
    .eq("user_id", user.id)
    .eq("match_id", args.matchId)
    .eq("country_code", args.countryCode)
    .eq("beer_label", args.beerLabel)
    .order("created_at", { ascending: false })
    .limit(1);
  if (selErr) return { error: selErr.message };
  if (!last || last.length === 0) return { error: "nothing to remove" };

  const { error: delErr } = await supabase.rpc("undo_pour", {
    target_drink_id: (last[0] as { id: string }).id,
  });
  if (delErr) return { error: delErr.message };

  revalidatePath(`/match/${args.matchId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Delete the user's most recent GENERIC country beer (country tagged, no
 *  beer_label) for a match + country. Backs the "any other [country] beer"
 *  stepper's − button. Worth +2 WCC, so the non-negative guard uses 2. */
export async function undoLastGenericCountryAction(args: {
  matchId: number;
  countryCode: string;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { data: last, error: selErr } = await supabase
    .from("wc_drinks")
    .select("id")
    .eq("user_id", user.id)
    .eq("match_id", args.matchId)
    .eq("country_code", args.countryCode)
    .is("beer_label", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (selErr) return { error: selErr.message };
  if (!last || last.length === 0) return { error: "nothing to remove" };

  const { error: delErr } = await supabase.rpc("undo_pour", {
    target_drink_id: (last[0] as { id: string }).id,
  });
  if (delErr) return { error: delErr.message };

  revalidatePath(`/match/${args.matchId}`);
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
    .select("id, match_id, country_code")
    .eq("user_id", user.id)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);
  if (selErr) return { error: selErr.message };
  if (!last || last.length === 0) return { error: "nothing recent to undo" };

  const { error: delErr } = await supabase.rpc("undo_pour", {
    target_drink_id: (last[0] as { id: string }).id,
  });
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
