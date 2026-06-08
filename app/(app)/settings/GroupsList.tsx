"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchGroupAction } from "@/app/(app)/account-actions";
import type { GroupMembershipSummary } from "@/lib/membership";

export function GroupsList({
  groups,
  activeGroupId,
}: {
  groups: GroupMembershipSummary[];
  activeGroupId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  function activate(groupId: string) {
    if (groupId === activeGroupId) return;
    setErr(null);
    setBusyId(groupId);
    startTransition(async () => {
      const res = await switchGroupAction(groupId);
      if ("error" in res) {
        setErr(res.error);
      } else {
        router.refresh();
        router.push("/");
      }
      setBusyId(null);
    });
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
      {groups.map((g, i) => {
        const active = g.groupId === activeGroupId;
        return (
          <div
            key={g.groupId}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 12,
              alignItems: "center",
              padding: "12px 14px",
              borderTop: i === 0 ? "none" : "1px solid var(--stout-12)",
              background: active ? "var(--paper)" : undefined,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: active ? "var(--pour)" : "var(--stout-12)",
                color: active ? "var(--stout)" : "var(--stout-55)",
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
                {active ? (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 9,
                      letterSpacing: "0.1em",
                      background: "var(--stout)",
                      color: "var(--foam-lit)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      verticalAlign: 2,
                    }}
                  >
                    ACTIVE
                  </span>
                ) : null}
              </div>
              <div className="t-small muted">
                {g.role === "host" ? "Host" : "Member"} · {g.memberCount}{" "}
                member{g.memberCount === 1 ? "" : "s"}
              </div>
            </div>
            {active ? (
              <span className="t-small muted">in</span>
            ) : (
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => activate(g.groupId)}
                disabled={pending}
              >
                {busyId === g.groupId ? "..." : "Switch"}
              </button>
            )}
          </div>
        );
      })}
      {err ? (
        <div
          className="t-small"
          style={{ color: "var(--penalty)", padding: "8px 14px", borderTop: "1px solid var(--stout-12)" }}
        >
          {err}
        </div>
      ) : null}
    </div>
  );
}
