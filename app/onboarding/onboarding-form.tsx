"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "create" | "join";

export function OnboardingForm({
  initialDisplayName,
}: {
  initialDisplayName?: string;
}) {
  const search = useSearchParams();
  const initialCode = search.get("code")?.trim() ?? "";
  const [mode, setMode] = useState<Mode>(initialCode ? "join" : "create");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState(initialCode);
  // When the user already has a membership we hide the display-name field
  // entirely - they keep the name they're already using.
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const hasExistingName = !!initialDisplayName;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // If the parent doesn't pass initialDisplayName but the user actually has
  // memberships (e.g. on a deep-linked /onboarding?add=1), fetch one client-side.
  useEffect(() => {
    if (initialDisplayName) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("wc_memberships")
        .select("display_name")
        .eq("user_id", user.id)
        .limit(1);
      if (cancelled) return;
      const name = (data?.[0] as { display_name: string } | undefined)?.display_name;
      if (name) setDisplayName(name);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDisplayName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const supabase = createClient();

    try {
      if (mode === "create") {
        const { error: rpcError } = await supabase.rpc("create_group", {
          group_name: groupName,
          host_display_name: displayName,
        });
        if (rpcError) throw rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc("accept_invite", {
          invite: inviteCode.trim(),
          member_display_name: displayName,
        });
        if (rpcError) throw rpcError;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          border: "1px solid var(--stout-12)",
          borderRadius: "var(--r-md)",
          padding: 4,
          gap: 4,
        }}
      >
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`btn ${mode === "create" ? "primary" : "ghost"} sm`}
          style={{ flex: 1 }}
        >
          Create bracket
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`btn ${mode === "join" ? "primary" : "ghost"} sm`}
          style={{ flex: 1 }}
        >
          Join with code
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {mode === "create" ? (
          <div>
            <div className="caps-label" style={{ marginBottom: 6 }}>Bracket name</div>
            <input
              className="input"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. The Couch Crew"
              required
            />
          </div>
        ) : (
          <div>
            <div className="caps-label" style={{ marginBottom: 6 }}>Invite code</div>
            <input
              className="input"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="8-character code"
              required
            />
          </div>
        )}

        {hasExistingName ? (
          <div className="t-small muted" style={{ paddingLeft: 2 }}>
            Joining as <strong style={{ color: "var(--stout)" }}>{displayName}</strong>. Change
            it any time from Settings.
          </div>
        ) : (
          <div>
            <div className="caps-label" style={{ marginBottom: 6 }}>Your display name</div>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What others see"
              required
            />
          </div>
        )}

        {error ? (
          <p className="t-small" style={{ color: "var(--penalty)" }}>{error}</p>
        ) : null}

        <button type="submit" className="btn primary block" disabled={isSubmitting || !displayName.trim()}>
          {isSubmitting ? "Working..." : mode === "create" ? "Create bracket" : "Join bracket"}
        </button>
      </form>
    </div>
  );
}
