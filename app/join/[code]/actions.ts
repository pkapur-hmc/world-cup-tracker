"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** One-tap accept from the /join/[code] confirm screen. The invite RPC is
 *  idempotent (on conflict do update), so re-tapping for a bracket you're
 *  already in is harmless - it just lands you back in it. */
export async function acceptInviteAction(
  code: string,
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/welcome");

  // The name others already see (renames touch membership rows) is the source
  // of truth; fall back to the name captured at signup.
  const { data: rows } = await supabase
    .from("wc_memberships")
    .select("display_name")
    .eq("user_id", user.id)
    .limit(1);
  const memberName = (rows?.[0] as { display_name?: string } | undefined)?.display_name?.trim();
  const metaName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const name = memberName || metaName;

  // No name on file (an older account that never set one) - send them through
  // onboarding to pick one; that route also accepts the invite.
  if (!name) redirect(`/onboarding?code=${encodeURIComponent(code)}`);

  const { data: groupId, error } = await supabase.rpc("accept_invite", {
    invite: code.trim(),
    member_display_name: name,
  });
  if (error) return { error: error.message };

  // Open the app straight into the bracket they just joined.
  if (typeof groupId === "string") {
    const jar = await cookies();
    jar.set("active_group_id", groupId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect("/leaderboard");
}
