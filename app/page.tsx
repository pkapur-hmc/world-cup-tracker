import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/login-form";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Logged in: send to drinker view (will redirect to /onboarding if no group yet)
    redirect("/drinker");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            World Cup Tracker
          </h1>
          <p className="text-sm text-zinc-500">
            Track cups during the 2026 tournament.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
