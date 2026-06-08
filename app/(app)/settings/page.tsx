import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllMemberships, getCurrentMembership } from "@/lib/membership";
import { BackButton } from "@/components/ui/BackButton";
import { signOutAction } from "@/app/(app)/account-actions";
import { AvatarUploader } from "./AvatarUploader";
import { GroupsList } from "./GroupsList";
import { HelpCard } from "./HelpCard";

export default async function SettingsPage() {
  const me = await getCurrentMembership();
  if (!me) redirect("/onboarding");
  const groups = await getAllMemberships();

  return (
    <>
      <div className="appbar">
        <BackButton fallback="/" />
        <div style={{ flex: 1 }}>
          <div className="t-h1">Settings</div>
          <div className="t-small muted">Profile, brackets, and rules</div>
        </div>
      </div>

      <div className="screen" style={{ gap: 16 }}>
        {/* Profile */}
        <section>
          <div className="section-label">
            <span className="caps-label">👤 Profile</span>
          </div>
          <AvatarUploader
            userId={me.userId}
            displayName={me.displayName}
            avatarUrl={me.avatarUrl}
            groupName={me.groupName}
          />
        </section>

        {/* Brackets */}
        <section>
          <div className="section-label">
            <span className="caps-label">🏆 Your brackets</span>
            <span className="t-small muted">
              {groups.length === 1
                ? "in 1 bracket"
                : `in ${groups.length} brackets`}
            </span>
          </div>
          <GroupsList groups={groups} />
          <Link
            href="/brackets/new"
            className="btn ghost block"
            style={{
              marginTop: 10,
              justifyContent: "space-between",
              textDecoration: "none",
              border: "1.5px dashed var(--stout-12)",
            }}
          >
            <span>+ Join or start another bracket</span>
            <span className="dim">›</span>
          </Link>
          <Link
            href="/group"
            className="btn ghost block"
            style={{
              marginTop: 8,
              justifyContent: "space-between",
              textDecoration: "none",
            }}
          >
            <span>Manage bracket · members, name, host</span>
            <span className="dim">›</span>
          </Link>
        </section>

        {/* How to play */}
        <section>
          <div className="section-label">
            <span className="caps-label">📖 How to play</span>
          </div>
          <HelpCard />
        </section>

        {/* Sign out */}
        <section>
          <form action={signOutAction}>
            <button
              type="submit"
              className="btn ghost block"
              style={{ color: "var(--penalty)" }}
            >
              Sign out
            </button>
          </form>
        </section>

        <div style={{ height: 16 }} />
      </div>
    </>
  );
}
