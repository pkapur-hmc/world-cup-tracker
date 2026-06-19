"use client";

import Link from "next/link";
import { useState } from "react";
import { inviteShareText } from "@/lib/origin";
import type { GroupMembershipSummary } from "@/lib/membership";

export function GroupsList({ groups }: { groups: GroupMembershipSummary[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function shareOrCopy(g: GroupMembershipSummary) {
    const text = inviteShareText(g.groupName, g.inviteCode);
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* user cancelled, fall through to copy */
    }
    await navigator.clipboard.writeText(text);
    setCopiedId(g.groupId);
    setTimeout(() => setCopiedId((c) => (c === g.groupId ? null : c)), 1500);
  }

  if (groups.length === 0) {
    return (
      <div className="card empty-block" style={{ textAlign: "center" }}>
        <div className="empty-lead">No brackets yet.</div>
        <div className="empty-sub">Join a friend&apos;s code or start your own.</div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      {groups.map((g, i) => (
        <div
          key={g.groupId}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 12,
            alignItems: "center",
            padding: "12px 14px",
            borderTop: i === 0 ? "none" : "1px solid var(--stout-12)",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--stout-12)",
              color: "var(--stout-55)",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--ff-display)",
              fontWeight: 800,
              fontSize: 16,
            }}
            aria-hidden
          >
            {g.groupName.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="t-sub" style={{ fontSize: 15 }}>
              {g.groupName}
            </div>
            <div className="t-small muted">
              {g.role === "host" ? "Host" : "Member"} · {g.memberCount}{" "}
              member{g.memberCount === 1 ? "" : "s"} · Code{" "}
              <strong className="tnum">{g.inviteCode}</strong>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch" }}>
            <button
              type="button"
              className="btn secondary sm"
              onClick={() => shareOrCopy(g)}
            >
              {copiedId === g.groupId ? "Copied!" : "Share invite"}
            </button>
            <Link
              href={{ pathname: "/group", query: { bracket: g.groupId } }}
              className="t-small"
              style={{ color: "var(--burn)", fontWeight: 700, textDecoration: "none", textAlign: "center" }}
            >
              Manage →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
