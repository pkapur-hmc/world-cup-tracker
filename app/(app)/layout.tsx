import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TabBar } from "@/components/ui/TabBar";
import { TopBar } from "@/components/ui/TopBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/welcome");

  const { data: memberships } = await supabase
    .from("wc_memberships")
    .select("group_id")
    .eq("user_id", user.id)
    .limit(1);
  if (!memberships || memberships.length === 0) redirect("/onboarding");

  return (
    <div className="app-shell">
      <div className="app-frame">
        <TopBar />
        {children}
        <TabBar />
      </div>
    </div>
  );
}
