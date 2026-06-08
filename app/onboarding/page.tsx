import { redirect } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/welcome");

  const { data: memberships } = await supabase
    .from("wc_memberships")
    .select("group_id")
    .limit(1);

  if (memberships && memberships.length > 0) {
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
          <div className="t-h1">One more thing</div>
          <div className="t-small muted">Create a watch group or join one with an invite code.</div>
        </div>
        <Suspense fallback={<div className="t-small muted">Loading...</div>}>
          <OnboardingForm />
        </Suspense>
      </div>
    </main>
  );
}
