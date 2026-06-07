import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // If they're already in a group, skip onboarding
  const { data: memberships } = await supabase
    .from("wc_memberships")
    .select("group_id")
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect("/drinker");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Welcome</h1>
          <p className="text-sm text-zinc-500">
            Create a new watch group or join one with an invite code.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </main>
  );
}
