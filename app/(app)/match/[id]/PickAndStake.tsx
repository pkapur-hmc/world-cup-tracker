"use client";

import { useEffect, useState, useTransition } from "react";
import { placePickAction } from "./actions";

export type ExistingPick = {
  pick: "A" | "D" | "B";
  stake: number;
} | null;

export function PickAndStake({
  matchId,
  isKnockout,
  teamACode,
  teamBCode,
  flagA,
  flagB,
  availableWcc,
  initial,
  locksAt,
}: {
  matchId: number;
  isKnockout: boolean;
  teamACode: string;
  teamBCode: string;
  flagA: string;
  flagB: string;
  availableWcc: number;
  initial: ExistingPick;
  locksAt: string;
}) {
  const [pick, setPick] = useState<"A" | "D" | "B" | null>(initial?.pick ?? null);
  const [stake, setStake] = useState<number>(initial?.stake ?? 0);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Total budget = available + any existing stake on this match (you can re-allocate it)
  const budget = availableWcc + (initial?.stake ?? 0);
  const stakeCapped = Math.min(stake, budget);
  const payout = stakeCapped > 0 ? 1 + 2 * stakeCapped : 1;
  const minsToLock = Math.floor((new Date(locksAt).getTime() - now) / 60_000);

  function submit() {
    if (!pick) {
      setErr("pick a side first");
      return;
    }
    setErr(null);
    startTransition(async () => {
      const res = await placePickAction({
        matchId,
        pick,
        stake: stakeCapped,
      });
      if ("error" in res) setErr(res.error);
      else setSavedAt(Date.now());
    });
  }

  function pickBtn(value: "A" | "D" | "B", flag: string, label: string) {
    const selected = pick === value;
    return (
      <button
        type="button"
        onClick={() => setPick(value)}
        className={`pick-btn ${selected ? "selected" : ""}`}
      >
        <span className="pick-flag">{flag}</span>
        <span className="pick-team">{label}</span>
        {selected ? <span className="pick-pct">your pick</span> : null}
      </button>
    );
  }

  const locked = minsToLock < 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="section-label">
          <span className="caps-label">Your pick</span>
          <span className="t-small muted">
            {locked
              ? "Pick locked"
              : minsToLock < 60
                ? `Locks in ${Math.max(0, minsToLock)} min`
                : `Locks at kickoff`}
          </span>
        </div>
        <div className={`pick-row ${isKnockout ? "knockout" : ""}`}>
          {pickBtn("A", flagA, teamACode)}
          {isKnockout ? null : pickBtn("D", "•", "DRAW")}
          {pickBtn("B", flagB, teamBCode)}
        </div>
      </div>

      <div>
        <div className="section-label">
          <span className="caps-label">Stake</span>
          <span className="t-small muted tnum">You have {budget} WCC available</span>
        </div>
        <div
          className="card well"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <div>
            <div className="t-small muted">Staking</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="t-h1 tnum">{stakeCapped}</span>
              <span className="t-small muted">WCC →</span>
              <span className="t-h2 tnum" style={{ color: "var(--pitch)" }}>+{payout}</span>
              <span className="t-small muted">WCP</span>
            </div>
          </div>
          <div className="stepper">
            <button
              type="button"
              onClick={() => setStake((s) => Math.max(0, s - 1))}
              disabled={stake <= 0 || pending}
              aria-label="Decrease stake"
            >
              −
            </button>
            <span className="value tnum">{stakeCapped}</span>
            <button
              type="button"
              onClick={() => setStake((s) => Math.min(budget, s + 1))}
              disabled={stake >= budget || pending}
              aria-label="Increase stake"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <div className="t-small" style={{ color: "var(--penalty)" }}>{err}</div>
      ) : null}

      <button
        className="btn primary block"
        onClick={submit}
        disabled={pending || locked}
      >
        {pending ? "Locking..." : savedAt ? "Saved · update" : initial ? "Update pick" : "Lock pick"}
      </button>
    </div>
  );
}
