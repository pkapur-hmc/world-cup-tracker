"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchGroupAction } from "@/app/(app)/account-actions";

export function BracketPicker({
  options,
  activeId,
}: {
  options: { groupId: string; groupName: string; memberCount: number }[];
  activeId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (next === activeId) return;
    startTransition(async () => {
      const res = await switchGroupAction(next);
      if (!("error" in res)) router.refresh();
    });
  }

  if (options.length <= 1) {
    const sole = options[0];
    return (
      <div className="t-small muted" style={{ marginBottom: 8 }}>
        {sole ? `${sole.groupName} · ${sole.memberCount} in` : null}
      </div>
    );
  }

  const active = options.find((o) => o.groupId === activeId) ?? options[0];

  return (
    <div
      style={{
        position: "relative",
        marginBottom: 10,
        background: "var(--paper)",
        borderRadius: "var(--r-md)",
        border: "1.5px solid var(--stout-12)",
      }}
    >
      {/* The actual select fills the entire pill so clicking anywhere opens it.
          The visible row below is a pointer-events:none decoration. */}
      <select
        value={activeId}
        onChange={onChange}
        disabled={pending}
        aria-label="Active bracket"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
          border: "none",
          appearance: "none",
        }}
      >
        {options.map((o) => (
          <option key={o.groupId} value={o.groupId}>
            {o.groupName} · {o.memberCount} in
          </option>
        ))}
      </select>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          pointerEvents: "none",
        }}
      >
        <span className="caps-label">🏆 Bracket</span>
        <span
          style={{
            flex: 1,
            fontFamily: "var(--ff-ui)",
            fontWeight: 700,
            fontSize: 15,
            color: "var(--stout)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {active.groupName} · {active.memberCount} in
        </span>
        <span
          className="dim"
          aria-hidden
          style={{ fontFamily: "var(--ff-display)", fontSize: 18 }}
        >
          ▾
        </span>
      </div>
    </div>
  );
}
