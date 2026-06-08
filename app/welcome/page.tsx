import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/login-form";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

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
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <Image src="/mark.svg" alt="" width={72} height={72} priority />
          <div className="t-display" style={{ fontSize: 36 }}>The World Cup Cup</div>
          <div className="t-small muted">Pour. Pick. Stamp. Track your bracket through the 2026 tournament.</div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
