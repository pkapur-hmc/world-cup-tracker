"use client";

import { useEffect, useState, useTransition } from "react";
import { placePickAction } from "./actions";
import { WccIcon, WcpIcon } from "@/components/ui/CurrencyIcon";
import { InfoChip } from "@/components/ui/InfoChip";
import { colorFor } from "@/data/country-colors";

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
  onPickChange,
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
  /** Fires whenever the selected side changes, so a parent can recolor the
   *  page to the picked country immediately (before the pick is even locked). */
  onPickChange?: (pick: "A" | "D" | "B") => void;
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

  const locked = minsToLock < 0;

  function choose(value: "A" | "D" | "B") {
    if (locked) return;
    setPick(value);
    onPickChange?.(value);
  }

  function contrastInk(hex: string): string {
    // simple luma check - pick dark text on light bgs, light text on dark
    const h = hex.replace("#", "");
    if (h.length !== 6) return "#1C140C";
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luma > 0.55 ? "#1C140C" : "#FFFEF2";
  }

  function pickBtn(value: "A" | "D" | "B", flag: string, label: string) {
    const selected = pick === value;
    const code = value === "A" ? teamACode : value === "B" ? teamBCode : null;
    const c = code ? colorFor(code) : null;
    const baseStyle: React.CSSProperties = locked
      ? { cursor: "not-allowed", opacity: selected ? 1 : 0.5 }
      : {};
    const selectedStyle: React.CSSProperties =
      selected && c
        ? {
            background: c.tint,
            borderColor: c.primary,
            color: c.ink,
            boxShadow: `0 0 0 2px ${c.primary}`,
          }
        : {};
    return (
      <button
        type="button"
        onClick={() => choose(value)}
        disabled={locked}
        className={`pick-btn ${selected ? "selected" : ""}`}
        style={{ ...baseStyle, ...selectedStyle }}
      >
        <span className="pick-flag">{flag}</span>
        <span className="pick-team">{label}</span>
        {selected ? <span className="pick-pct">your pick</span> : null}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {locked ? (
        <div
          className="card"
          style={{
            background: "var(--paper)",
            borderColor: "var(--stout-35)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
          }}
        >
          <span aria-hidden style={{ fontSize: 18 }}>🔒</span>
          <div>
            <div className="t-sub" style={{ fontSize: 14 }}>Pick locked at kickoff</div>
            <div className="t-small muted">
              Stakes and picks can&apos;t be changed once the game starts.
            </div>
          </div>
        </div>
      ) : null}
      <div>
        <div className="section-label">
          <span className="caps-label">Your pick</span>
          <span className="t-small muted">
            {locked
              ? "Locked"
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
          <span className="caps-label" style={{ display: "inline-flex", alignItems: "center" }}>
            Stake
            <InfoChip label="How does staking work?">
              <strong>Risk WCC to earn more WCP.</strong>
              <br />
              Stake <em>X</em> WCC on your pick. If you&apos;re right, you earn <strong>1 + 2×X</strong> WCP and your stake is gone. If wrong, you just lose the stake.
              <br />
              Picking with 0 stake still earns 1 WCP if right.
            </InfoChip>
          </span>
          <span className="t-small muted">Spend WCC to earn WCP</span>
        </div>

        <div className="balance-banner">
          <span className="bal-icon"><WccIcon size={20} /></span>
          <div className="bal-text">
            <div className="t-small muted">You have</div>
            <div className="t-h1 tnum">
              {budget} <span className="t-small muted">WCC available</span>
            </div>
          </div>
          <div className="bal-right t-small muted">
            {stakeCapped > 0 ? `${budget - stakeCapped} left after this stake` : "tap + to stake"}
          </div>
        </div>

        <div
          className="card well"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}
        >
          <div>
            <div className="t-small muted">Staking</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <span className="cur-tag"><WccIcon size={18} /><span className="t-h1 tnum">{stakeCapped}</span></span>
              <span className="t-small muted">→</span>
              <span className="cur-tag" style={{ color: "var(--pitch)" }}>
                <WcpIcon size={18} />
                <span className="t-h2 tnum">+{payout}</span>
              </span>
            </div>
          </div>
          <div className="stepper">
            <button
              type="button"
              onClick={() => setStake((s) => Math.max(0, s - 1))}
              disabled={stake <= 0 || pending || locked}
              aria-label="Decrease stake"
            >
              −
            </button>
            <span className="value tnum">{stakeCapped}</span>
            <button
              type="button"
              onClick={() => setStake((s) => Math.min(budget, s + 1))}
              disabled={stake >= budget || pending || locked}
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
        style={
          pick && pick !== "D"
            ? (() => {
                const c = colorFor(pick === "A" ? teamACode : teamBCode);
                return {
                  background: c.primary,
                  borderColor: c.primary,
                  color: contrastInk(c.primary),
                };
              })()
            : undefined
        }
      >
        {pending ? "Locking..." : savedAt ? "Saved · update" : initial ? "Update pick" : "Lock pick"}
      </button>
    </div>
  );
}
