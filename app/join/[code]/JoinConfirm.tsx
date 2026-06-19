"use client";

import { useState, useTransition } from "react";
import { acceptInviteAction } from "./actions";

/** The signed-in confirm step: one tap accepts the invite. On success the
 *  server action redirects, so this component only ever surfaces errors. */
export function JoinConfirm({ code }: { code: string }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function join() {
    setErr(null);
    startTransition(async () => {
      const res = await acceptInviteAction(code);
      if (res && "error" in res) setErr(res.error);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="button"
        className="btn primary block"
        onClick={join}
        disabled={pending}
      >
        {pending ? "Joining..." : "Join this bracket"}
      </button>
      {err ? (
        <p className="t-small" style={{ color: "var(--penalty)", textAlign: "center" }}>
          {err}
        </p>
      ) : null}
    </div>
  );
}
