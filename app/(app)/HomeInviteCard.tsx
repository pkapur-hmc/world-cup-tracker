"use client";

import { useState } from "react";
import { inviteShareText } from "@/lib/origin";

/**
 * Home-page invite card. One-tap "Copy invite link" with the group's code
 * shown big. Uses Web Share API when available so people can fire it into
 * iMessage / WhatsApp without leaving the app.
 */
export function HomeInviteCard({
  inviteCode,
  groupName,
}: {
  inviteCode: string;
  groupName: string;
}) {
  const [copied, setCopied] = useState(false);
  const shareText = inviteShareText(groupName, inviteCode);

  async function shareOrCopy() {
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ text: shareText });
        return;
      }
    } catch {
      /* user cancelled or share unsupported, fall through to copy */
    }
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={shareOrCopy}
      className="card elevated"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
        font: "inherit",
        color: "inherit",
        border: "1.5px dashed var(--burn)",
        background: "var(--bubble)",
      }}
    >
      <div>
        <div className="caps-label">Invite friends</div>
        <div className="t-sub" style={{ fontSize: 15 }}>
          {copied ? "Link copied!" : "Tap to share invite"}
        </div>
        <div className="t-small muted tnum" style={{ marginTop: 2 }}>
          Code: <strong>{inviteCode}</strong>
        </div>
      </div>
      <div style={{ fontSize: 26 }} aria-hidden>
        🍺
      </div>
    </button>
  );
}
