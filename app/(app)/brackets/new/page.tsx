import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/BackButton";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";

/**
 * Add another bracket. Reachable from Settings → "+ Join or start another
 * bracket" and the Home brackets list "+ New". Reuses OnboardingForm
 * (which auto-fills the existing display name) but lives at its own URL
 * so the /onboarding route stays first-time-only.
 */
export default async function NewBracketPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/welcome");

  const { data: memberships } = await supabase
    .from("wc_memberships")
    .select("display_name")
    .limit(1);
  const existingDisplayName =
    (memberships?.[0] as { display_name?: string } | undefined)?.display_name;

  return (
    <>
      <div className="appbar">
        <BackButton fallback="/settings" />
        <div style={{ flex: 1 }}>
          <div className="t-h1">Another bracket</div>
          <div className="t-small muted">
            Join or create another. Your drinks &amp; stamps count everywhere.
          </div>
        </div>
      </div>

      <div className="screen" style={{ gap: 16 }}>
        <Suspense fallback={<div className="t-small muted">Loading...</div>}>
          <OnboardingForm initialDisplayName={existingDisplayName} />
        </Suspense>
        <div style={{ height: 16 }} />
      </div>
    </>
  );
}
