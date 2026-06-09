"use client";

import { useState, type ReactNode } from "react";
import { colorFor } from "@/data/country-colors";
import { PickAndStake } from "./PickAndStake";

/**
 * Client shell for a scheduled (pre-kickoff) match. Holds the currently
 * selected side so the match hero recolors to the picked country the instant
 * you tap a side - no round-trip, no waiting for the lock to settle. After the
 * pick is locked the server re-renders this with `initial` set, so the color
 * sticks.
 *
 * `hero` and `groupPicks` are server-rendered nodes passed straight through.
 */
export function PreMatchInteractive({
  matchId,
  isKnockout,
  teamACode,
  teamBCode,
  flagA,
  flagB,
  availableWcc,
  initial,
  locksAt,
  hero,
  groupPicks,
}: {
  matchId: number;
  isKnockout: boolean;
  teamACode: string | null;
  teamBCode: string | null;
  flagA: string;
  flagB: string;
  availableWcc: number;
  initial: { pick: "A" | "D" | "B"; stake: number } | null;
  locksAt: string;
  hero: ReactNode;
  groupPicks: ReactNode;
}) {
  const [pick, setPick] = useState<"A" | "D" | "B" | null>(initial?.pick ?? null);
  const pickedCode = pick === "A" ? teamACode : pick === "B" ? teamBCode : null;
  const accent = colorFor(pickedCode);

  return (
    <>
      <div
        style={{
          borderRadius: "var(--r-lg)",
          padding: "6px 14px 10px",
          borderLeft: pickedCode ? `4px solid ${accent.primary}` : "4px solid transparent",
          background: pickedCode ? accent.tint : undefined,
          transition: "background 220ms ease, border-color 220ms ease",
        }}
      >
        {hero}
      </div>

      {teamACode && teamBCode ? (
        <PickAndStake
          matchId={matchId}
          isKnockout={isKnockout}
          teamACode={teamACode}
          teamBCode={teamBCode}
          flagA={flagA}
          flagB={flagB}
          availableWcc={availableWcc}
          initial={initial}
          locksAt={locksAt}
          onPickChange={setPick}
        />
      ) : (
        <div className="card empty-block" style={{ textAlign: "center" }}>
          <div className="empty-lead">Not your turn yet.</div>
          <div className="empty-sub">Knockout picks open after group stage wraps.</div>
        </div>
      )}

      {groupPicks}
    </>
  );
}
