import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentMembership = {
  groupId: string;
  groupName: string;
  inviteCode: string;
  userId: string;
  displayName: string;
  role: "host" | "member";
  memberCount: number;
};

/**
 * The active membership for the current request.
 * Returns null if not signed in or not in any group.
 * Memoised per-request via React cache().
 */
export const getCurrentMembership = cache(async (): Promise<CurrentMembership | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("wc_memberships")
    .select("group_id, display_name, role, wc_groups(id, name, invite_code)")
    .order("joined_at")
    .limit(1);

  if (!memberships || memberships.length === 0) return null;

  const m = memberships[0] as unknown as {
    group_id: string;
    display_name: string;
    role: "host" | "member";
    wc_groups: { id: string; name: string; invite_code: string };
  };

  const { count } = await supabase
    .from("wc_memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("group_id", m.group_id);

  return {
    groupId: m.group_id,
    groupName: m.wc_groups.name,
    inviteCode: m.wc_groups.invite_code,
    userId: user.id,
    displayName: m.display_name,
    role: m.role,
    memberCount: count ?? 1,
  };
});
