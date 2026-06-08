"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/** Switch which group this session treats as "active" across the app.
 *  Verifies the caller is a member before writing the cookie. */
export async function switchGroupAction(
  groupId: string,
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
    .eq("group_id", groupId)
    .limit(1);
  if (!m || m.length === 0) return { error: "not a member of that group" };

  const jar = await cookies();
  jar.set("active_group_id", groupId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Save an uploaded avatar URL onto every membership row for this user.
 *  Per-group avatar override could come later; right now one photo follows
 *  the user across all groups they're in. */
export async function setAvatarUrlAction(
  publicUrl: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not signed in" };

  const { error } = await supabase
    .from("wc_memberships")
    .update({ avatar_url: publicUrl })
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath("/group");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/welcome");
}
