"use client";

import { useState } from "react";
import { HelpSheet } from "@/components/ui/HelpSheet";

export function HelpCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card"
        style={{
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          font: "inherit",
          color: "inherit",
          background: "var(--bubble)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <div className="t-sub" style={{ fontSize: 15 }}>How the Cup works</div>
          <div className="t-small muted">
            WCC, WCP, picks, stakes, stamps - the whole loop.
          </div>
        </div>
        <span className="dim" style={{ fontFamily: "var(--ff-display)", fontWeight: 600, fontSize: 22 }}>›</span>
      </button>
      <HelpSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
