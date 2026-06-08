"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "create" | "join";

export function OnboardingForm() {
  const search = useSearchParams();
  const initialCode = search.get("code")?.trim() ?? "";
  const [mode, setMode] = useState<Mode>(initialCode ? "join" : "create");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
          Create group
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
            <div className="caps-label" style={{ marginBottom: 6 }}>Group name</div>
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

        {error ? (
          <p className="t-small" style={{ color: "var(--penalty)" }}>{error}</p>
        ) : null}

        <button type="submit" className="btn primary block" disabled={isSubmitting}>
          {isSubmitting ? "Working..." : mode === "create" ? "Create group" : "Join group"}
        </button>
      </form>
    </div>
  );
}
