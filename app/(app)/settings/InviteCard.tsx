"use client";

import { useState } from "react";

export function InviteCard({
  inviteCode,
  groupName,
}: {
  inviteCode: string;
  groupName: string;
}) {
  const [copied, setCopied] = useState(false);
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : "";

  async function shareOrCopy() {
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({
          title: `Join ${groupName} on The World Cup Cup`,
          text: `Hop into our World Cup 2026 bracket: ${inviteUrl}`,
          url: inviteUrl,
        });
        return;
      }
    } catch {
      /* user cancelled, fall through to copy */
    }
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card">
      <div
        style={{
          fontFamily: "var(--ff-display)",
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "0.02em",
          padding: "10px 14px",
          background: "var(--paper)",
          borderRadius: "var(--r-md)",
          textAlign: "center",
          userSelect: "all",
        }}
      >
        {inviteCode}
      </div>
      <div className="t-small muted" style={{ marginTop: 8, textAlign: "center", wordBreak: "break-all" }}>
        {inviteUrl}
      </div>
      <button
        type="button"
        className="btn primary block"
        onClick={shareOrCopy}
        style={{ marginTop: 10 }}
      >
        {copied ? "Link copied!" : "Share invite"}
      </button>
    </div>
  );
}
