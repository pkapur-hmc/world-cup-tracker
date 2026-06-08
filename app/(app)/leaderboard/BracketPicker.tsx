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

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 10,
        padding: "8px 12px",
        background: "var(--paper)",
        borderRadius: "var(--r-md)",
        border: "1.5px solid var(--stout-12)",
      }}
    >
      <span className="caps-label">🏆 Bracket</span>
      <select
        value={activeId}
        onChange={onChange}
        disabled={pending}
        style={{
          flex: 1,
          font: "inherit",
          fontFamily: "var(--ff-ui)",
          fontWeight: 700,
          fontSize: 15,
          color: "var(--stout)",
          background: "transparent",
          border: "none",
          padding: "4px 6px",
          appearance: "none",
          cursor: "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.groupId} value={o.groupId}>
            {o.groupName} · {o.memberCount} in
          </option>
        ))}
      </select>
      <span className="dim" aria-hidden style={{ fontFamily: "var(--ff-display)", fontSize: 18 }}>▾</span>
    </label>
  );
}
