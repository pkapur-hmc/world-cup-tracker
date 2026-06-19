import { redirect } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/welcome");

  // Onboarding is for first-time joiners only. Existing users adding more
  // brackets use /brackets/new instead - that route reuses the same form
  // but skips the display-name prompt. Carry any invite code through so the
  // form arrives prefilled instead of dropping it.
  const { data: memberships } = await supabase
    .from("wc_memberships")
    .select("group_id")
    .limit(1);
  if (memberships && memberships.length > 0) {
    redirect(code ? `/brackets/new?code=${encodeURIComponent(code)}` : "/brackets/new");
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
          <Image src="/stein.svg" alt="" width={44} height={64} priority />
          <div className="t-h1">One more thing</div>
          <div className="t-small muted">Create a bracket or join one with an invite code.</div>
        </div>
        <Suspense fallback={<div className="t-small muted">Loading...</div>}>
          <OnboardingForm />
        </Suspense>
      </div>
    </main>
  );
}
