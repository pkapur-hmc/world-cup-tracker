"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchGroupAction } from "@/app/(app)/account-actions";

/** "View" on a bracket row: make that bracket the active one, then open the
 *  leaderboard. The leaderboard reads the active_group_id cookie, so without
 *  switching first it would just re-show whatever bracket was last active. */
export function ViewBracketLink({ groupId }: { groupId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    startTransition(async () => {
      await switchGroupAction(groupId);
      router.push("/leaderboard");
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="t-small"
      style={{
        color: "var(--burn)",
        fontWeight: 700,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        font: "inherit",
        opacity: pending ? 0.6 : 1,
      }}
    >
      View →
    </button>
  );
}
