import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type CurrentMembership = {
  groupId: string;
  groupName: string;
  inviteCode: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "host" | "member";
  memberCount: number;
};

export type GroupMembershipSummary = {
  groupId: string;
  groupName: string;
  inviteCode: string;
  role: "host" | "member";
  joinedAt: string;
  memberCount: number;
};

type MembershipRow = {
  group_id: string;
  display_name: string;
  avatar_url: string | null;
  role: "host" | "member";
  joined_at?: string;
  wc_groups: { id: string; name: string; invite_code: string };
};

async function fetchAllMemberships(userId: string): Promise<MembershipRow[]> {
  const supabase = await createClient();
  // avatar_url may not exist yet if scripts/003_avatars.sql hasn't been run.
  const withAvatar = await supabase
    .from("wc_memberships")
    .select("group_id, display_name, avatar_url, role, joined_at, wc_groups(id, name, invite_code)")
    .eq("user_id", userId)
    .order("joined_at");
  if (!withAvatar.error && withAvatar.data) {
    return withAvatar.data as unknown as MembershipRow[];
  }
  const fallback = await supabase
    .from("wc_memberships")
    .select("group_id, display_name, role, joined_at, wc_groups(id, name, invite_code)")
    .eq("user_id", userId)
    .order("joined_at");
  return ((fallback.data ?? []) as unknown as Omit<MembershipRow, "avatar_url">[]).map(
    (r) => ({ ...r, avatar_url: null }),
  );
}

/**
 * The active membership for the current request.
 * Picks the group from the `active_group_id` cookie if set (and the user is
 * actually in that group); otherwise the user's earliest membership.
 * Memoised per-request via React cache().
 */
export const getCurrentMembership = cache(async (): Promise<CurrentMembership | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const memberships = await fetchAllMemberships(user.id);
  if (memberships.length === 0) return null;

  const jar = await cookies();
  const preferred = jar.get("active_group_id")?.value;
  const m =
    (preferred && memberships.find((r) => r.group_id === preferred)) || memberships[0];

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
    avatarUrl: m.avatar_url ?? null,
    role: m.role,
    memberCount: count ?? 1,
  };
});

/** Every group this user belongs to, with member counts. Use for the
 *  Settings group switcher / multi-bracket view. */
export const getAllMemberships = cache(async (): Promise<GroupMembershipSummary[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const rows = await fetchAllMemberships(user.id);
  if (rows.length === 0) return [];

  // Fetch member counts in parallel
  const counts = await Promise.all(
    rows.map(async (r) => {
      const { count } = await supabase
        .from("wc_memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("group_id", r.group_id);
      return count ?? 1;
    }),
  );

  return rows.map((r, i) => ({
    groupId: r.group_id,
    groupName: r.wc_groups.name,
    inviteCode: r.wc_groups.invite_code,
    role: r.role,
    joinedAt: r.joined_at ?? "",
    memberCount: counts[i],
  }));
});
