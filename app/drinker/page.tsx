import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DrinkerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: memberships } = await supabase
    .from("wc_memberships")
    .select("group_id, display_name, role, wc_groups(name, invite_code)")
    .limit(1);

  if (!memberships || memberships.length === 0) {
    redirect("/onboarding");
  }

  const m = memberships[0] as unknown as {
    group_id: string;
    display_name: string;
    role: "host" | "member";
    wc_groups: { name: string; invite_code: string };
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <p className="text-sm text-zinc-500">{m.wc_groups.name}</p>
          <h1 className="text-2xl font-semibold">Hi, {m.display_name}</h1>
        </div>
        <div className="rounded-lg border border-zinc-200 p-6 space-y-2">
          <p className="text-sm text-zinc-500">Drinker page is coming.</p>
          <p className="text-xs text-zinc-400">
            Auth + group bootstrap working. Phase 1 builds the tap-to-log UI.
          </p>
        </div>
        <p className="text-xs text-zinc-400">
          Invite code:{" "}
          <span className="font-mono text-zinc-700">
            {m.wc_groups.invite_code}
          </span>
        </p>
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="text-xs text-zinc-500 underline hover:text-zinc-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
