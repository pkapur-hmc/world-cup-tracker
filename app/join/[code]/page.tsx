import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/login-form";
import { JoinConfirm } from "./JoinConfirm";

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
          <Image src="/crest.svg" alt="World Cup Cup" width={110} height={110} priority />
          <div className="t-h1">You&apos;re invited</div>
          {groupName ? (
            <div className="t-small muted">
              to <strong style={{ color: "var(--stout)" }}>{groupName}</strong> on The World Cup Cup
            </div>
          ) : (
            <div className="t-small muted">
              That code doesn&apos;t ring a bell{user ? "." : ", but you can still sign in to join a group."}
            </div>
          )}
        </div>

        {user ? (
          groupName ? (
            // Signed in already: skip the form, just confirm-join in one tap.
            <JoinConfirm code={code} />
          ) : (
            <Link href="/" className="btn secondary block" style={{ textAlign: "center" }}>
              Back to my brackets
            </Link>
          )
        ) : (
          <>
            {/* After auth, come back HERE (not onboarding) so returning users get
                the one-tap confirm and new signups - who set a name at signup -
                land on the same confirm step. */}
            <LoginForm redirectTo={`/join/${encodeURIComponent(code)}`} />
            <Link href="/welcome" className="t-small muted" style={{ textAlign: "center", textDecoration: "none" }}>
              Just looking around →
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
