"use client";

import { useState, useTransition } from "react";
import {
  deleteGroupAction,
  leaveGroupAction,
  promoteAction,
  removeAction,
  renameGroupAction,
  resetCodeAction,
  updateMyDisplayNameAction,
} from "./actions";
import { inviteUrlFor } from "@/lib/origin";

type Member = {
  userId: string;
  displayName: string;
  role: "host" | "member";
  joinedAt: string;
};

export function GroupSettings({
  groupId,
  groupName: initialGroupName,
  inviteCode: initialInviteCode,
  members,
  meUserId,
  meDisplayName,
  meIsHost,
  hostCount,
}: {
  groupId: string;
  groupName: string;
  inviteCode: string;
  members: Member[];
  meUserId: string;
  meDisplayName: string;
  meIsHost: boolean;
  hostCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState(initialInviteCode);
  const [groupName, setGroupName] = useState(initialGroupName);
  const [displayName, setDisplayName] = useState(meDisplayName);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function go(fn: () => Promise<{ ok: true } | { ok: true; code: string } | { error: string } | void>) {
    setErr(null);
    setInfo(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res && "error" in res && res.error) setErr(res.error);
        if (res && "code" in res && res.code) {
          setCode(res.code);
          setInfo("Invite code reset.");
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const inviteUrl = inviteUrlFor(code);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div className="caps-label" style={{ marginBottom: 8 }}>Invite</div>
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
          {code}
        </div>
        <div className="t-small muted" style={{ marginTop: 8, textAlign: "center", wordBreak: "break-all" }}>
          {inviteUrl}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            type="button"
            className="btn secondary block"
            onClick={() => navigator.clipboard.writeText(inviteUrl)}
          >
            Copy link
          </button>
          {meIsHost ? (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => go(() => resetCodeAction(groupId))}
              disabled={pending}
              style={{ whiteSpace: "nowrap" }}
            >
              Reset code
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <div className="section-label">
          <span className="caps-label">Members</span>
          <span className="t-small muted">{members.length}</span>
        </div>
        <div className="card">
          {members.map((m) => {
            const isYou = m.userId === meUserId;
            const isHost = m.role === "host";
            const canActOnThem = meIsHost && !isYou;
            return (
              <div
                key={m.userId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--stout-12)",
                }}
              >
                <div className="avatar sm">{m.displayName.slice(0, 1).toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {m.displayName}
                    {isYou ? " (you)" : ""}
                  </div>
                  <div className="t-small muted">
                    {isHost ? "Host" : "Member"} · joined {new Date(m.joinedAt).toLocaleDateString()}
                  </div>
                </div>
                {canActOnThem ? (
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Member actions"
                      onClick={() => setOpenMenu(openMenu === m.userId ? null : m.userId)}
                    >
                      ⋯
                    </button>
                    {openMenu === m.userId ? (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "100%",
                          background: "var(--foam-lit)",
                          border: "1px solid var(--stout-12)",
                          borderRadius: "var(--r-md)",
                          padding: 6,
                          minWidth: 180,
                          zIndex: 30,
                        }}
                      >
                        {!isHost ? (
                          <button
                            type="button"
                            className="btn ghost block"
                            onClick={() => {
                              setOpenMenu(null);
                              go(() => promoteAction(groupId, m.userId));
                            }}
                            disabled={pending}
                          >
                            Promote to host
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn ghost block"
                          style={{ color: "var(--penalty)" }}
                          onClick={() => {
                            setOpenMenu(null);
                            if (confirm(`Remove ${m.displayName} from the bracket?`)) {
                              go(() => removeAction(groupId, m.userId));
                            }
                          }}
                          disabled={pending}
                        >
                          Remove from bracket
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="section-label">
          <span className="caps-label">You</span>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div className="caps-label" style={{ marginBottom: 6 }}>Display name</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <button
                type="button"
                className="btn secondary sm"
                disabled={pending || displayName === meDisplayName || !displayName.trim()}
                onClick={() => go(() => updateMyDisplayNameAction(groupId, displayName.trim()))}
              >
                Save
              </button>
            </div>
          </div>
          <button
            type="button"
            className="btn ghost block"
            disabled={pending}
            onClick={() => {
              const isSoleHost = meIsHost && hostCount <= 1;
              if (isSoleHost) {
                alert("Promote someone or delete the bracket first - you're the only host.");
                return;
              }
              if (confirm("Leave this bracket? Your drinks &amp; stamps still count in your others.")) {
                go(() => leaveGroupAction(groupId));
              }
            }}
          >
            Leave bracket
          </button>
        </div>
      </div>

      {meIsHost ? (
        <div>
          <div className="section-label">
            <span className="caps-label">Bracket settings (host)</span>
          </div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div className="caps-label" style={{ marginBottom: 6 }}>Bracket name</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <button
                  type="button"
                  className="btn secondary sm"
                  disabled={pending || groupName === initialGroupName || !groupName.trim()}
                  onClick={() => go(() => renameGroupAction(groupId, groupName.trim()))}
                >
                  Save
                </button>
              </div>
            </div>
            <button
              type="button"
              className="btn ghost block"
              style={{ color: "var(--penalty)" }}
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete "${initialGroupName}" and all its data? This can't be undone.`)) {
                  go(() => deleteGroupAction(groupId));
                }
              }}
            >
              Delete bracket
            </button>
          </div>
        </div>
      ) : null}

      {err ? (
        <div className="t-small" style={{ color: "var(--penalty)" }}>{err}</div>
      ) : null}
      {info ? <div className="t-small muted">{info}</div> : null}
    </div>
  );
}
