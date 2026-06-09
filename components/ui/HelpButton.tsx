"use client";

import { useState } from "react";
import { HelpSheet } from "@/components/ui/HelpSheet";

/**
 * Persistent "?" launcher for the HelpSheet. Drop into any appbar so the
 * how-to-play is one tap from every screen, not buried in Settings.
 */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="How the Cup works"
        onClick={() => setOpen(true)}
        style={{
          fontFamily: "var(--ff-display)",
          fontWeight: 800,
          fontSize: 18,
        }}
      >
        ?
      </button>
      <HelpSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
