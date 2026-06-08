import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/login-form";

export default async function JoinByCode({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Already signed in - hop to onboarding with the code prefilled.
    redirect(`/onboarding?code=${encodeURIComponent(code)}`);
  }

  // RLS gates wc_groups SELECT to existing members, so a fresh joiner can't
  // peek by invite_code via the table. peek_invite is a security-definer RPC
  // that returns just the group name and bypasses RLS.
  const { data: peeked } = await supabase.rpc("peek_invite", { invite: code });
  const groupName = (peeked as { name: string }[] | null)?.[0]?.name;

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
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Image src="/mark.svg" alt="" width={56} height={56} priority />
          <div className="t-h1">You&apos;re invited</div>
          {groupName ? (
            <div className="t-small muted">
              to <strong style={{ color: "var(--stout)" }}>{groupName}</strong> on The World Cup Cup
            </div>
          ) : (
            <div className="t-small muted">
              That code doesn&apos;t ring a bell, but you can still sign in to join a group.
            </div>
          )}
        </div>
        <LoginForm />
        <Link href="/welcome" className="t-small muted" style={{ textAlign: "center", textDecoration: "none" }}>
          Just looking around →
        </Link>
      </div>
    </main>
  );
}
