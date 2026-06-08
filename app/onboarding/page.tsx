import { redirect } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const params = await searchParams;
  const adding = params.add === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/welcome");

  const { data: memberships } = await supabase
    .from("wc_memberships")
    .select("group_id")
    .limit(1);

  // Only redirect first-timers. If the user is explicitly adding another
  // bracket from Settings, let them through.
  if (memberships && memberships.length > 0 && !adding) {
    redirect("/");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Image src="/mark.svg" alt="" width={48} height={48} priority />
          <div className="t-h1">{adding ? "Another bracket" : "One more thing"}</div>
          <div className="t-small muted">
            {adding
              ? "Create a new bracket or join one with an invite code. You can be in as many as you want."
              : "Create a bracket or join one with an invite code."}
          </div>
        </div>
        <Suspense fallback={<div className="t-small muted">Loading...</div>}>
          <OnboardingForm />
        </Suspense>
      </div>
    </main>
  );
}
