import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/BackButton";
import { GroupSettings } from "./GroupSettings";

export default async function GroupPage({
  searchParams,
}: {
  searchParams: Promise<{ bracket?: string }>;
}) {
  const me = await getCurrentMembership();
  if (!me) return null;

  const { bracket } = await searchParams;
  const supabase = await createClient();

  // Resolve which bracket we're managing. With ?bracket=<id>, use that (after
  // verifying membership). Otherwise fall back to the current active bracket
  // from the cookie - same as before for direct visits.
  let groupId = me.groupId;
  let groupName = me.groupName;
  let inviteCode = me.inviteCode;
  let myRole = me.role;
  let memberCount = me.memberCount;

  if (bracket && bracket !== me.groupId) {
    const { data: m } = await supabase
      .from("wc_memberships")
      .select("group_id, role, wc_groups(name, invite_code)")
      .eq("user_id", me.userId)
      .eq("group_id", bracket)
      .limit(1);
    const row = (m ?? [])[0] as unknown as
      | {
          group_id: string;
          role: "host" | "member";
          wc_groups: { name: string; invite_code: string };
        }
      | undefined;
    if (!row) redirect("/settings");
    groupId = row.group_id;
    groupName = row.wc_groups.name;
    inviteCode = row.wc_groups.invite_code;
    myRole = row.role;
    const { count } = await supabase
      .from("wc_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("group_id", groupId);
    memberCount = count ?? 1;
  }

  const { data: members } = await supabase
    .from("wc_memberships")
    .select("user_id, display_name, role, joined_at")
    .eq("group_id", groupId)
    .order("joined_at");

  const list = (members ?? []) as {
    user_id: string;
    display_name: string;
    role: "host" | "member";
    joined_at: string;
  }[];
  const hostCount = list.filter((m) => m.role === "host").length;

  return (
    <>
      <div className="appbar">
        <BackButton fallback="/settings" />
        <div style={{ flex: 1 }}>
          <div className="t-h2">{groupName}</div>
          <div className="t-small muted">
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="screen">
        <GroupSettings
          groupId={groupId}
          groupName={groupName}
          inviteCode={inviteCode}
          members={list.map((m) => ({
            userId: m.user_id,
            displayName: m.display_name,
            role: m.role,
            joinedAt: m.joined_at,
          }))}
          meUserId={me.userId}
          meIsHost={myRole === "host"}
          hostCount={hostCount}
        />

        <form action="/auth/sign-out" method="post" style={{ marginTop: 18 }}>
          <button type="submit" className="btn ghost block">
            Sign out
          </button>
        </form>
        <div style={{ height: 16 }} />
      </div>
    </>
  );
}
