import { getCurrentMembership } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/BackButton";
import { GroupSettings } from "./GroupSettings";

export default async function GroupPage() {
  const member = await getCurrentMembership();
  if (!member) return null;

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("wc_memberships")
    .select("user_id, display_name, role, joined_at")
    .eq("group_id", member.groupId)
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
        <BackButton fallback="/" />
        <div style={{ flex: 1 }}>
          <div className="t-h2">{member.groupName}</div>
          <div className="t-small muted">
            {member.memberCount} member{member.memberCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="screen">
        <GroupSettings
          groupId={member.groupId}
          groupName={member.groupName}
          inviteCode={member.inviteCode}
          members={list.map((m) => ({
            userId: m.user_id,
            displayName: m.display_name,
            role: m.role,
            joinedAt: m.joined_at,
          }))}
          meUserId={member.userId}
          meDisplayName={member.displayName}
          meIsHost={member.role === "host"}
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
