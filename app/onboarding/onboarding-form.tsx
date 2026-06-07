"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "create" | "join";

export function OnboardingForm() {
  const [mode, setMode] = useState<Mode>("create");
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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
      router.push("/drinker");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-md border border-zinc-200 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 rounded px-3 py-1.5 transition ${
            mode === "create" ? "bg-zinc-900 text-white" : "text-zinc-600"
          }`}
        >
          Create group
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 rounded px-3 py-1.5 transition ${
            mode === "join" ? "bg-zinc-900 text-white" : "text-zinc-600"
          }`}
        >
          Join with code
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "create" ? (
          <div className="space-y-2">
            <Label htmlFor="groupName">Group name</Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. The Couch Crew"
              required
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="inviteCode">Invite code</Label>
            <Input
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="8-character code"
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="displayName">Your display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="What others see"
            required
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting
            ? "Working..."
            : mode === "create"
              ? "Create group"
              : "Join group"}
        </Button>
      </form>
    </div>
  );
}
