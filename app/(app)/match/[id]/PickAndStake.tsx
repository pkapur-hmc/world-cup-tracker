"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { placePickAction } from "./actions";
import { useUnsavedPickGuard } from "./UnsavedPickGuard";
import { WccIcon } from "@/components/ui/CurrencyIcon";
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
  committedElsewhere,
  initial,
  locksAt,
  stakeMult = 1,
}: {
  matchId: number;
  isKnockout: boolean;
  teamACode: string;
  teamBCode: string;
  flagA: string;
  flagB: string;
  /** Headline total WCC (does NOT net out pending stakes). */
  availableWcc: number;
  /** WCC already staked on OTHER unsettled games - can't be re-staked here. */
  committedElsewhere: number;
  initial: ExistingPick;
  locksAt: string;
  /** Comeback stake multiplier (1-2x) - the further behind you are, the more a
   *  correct pick pays. Shown live as a preview; the paid rate locks at kickoff.
   *  1 when not live. */
  stakeMult?: number;
}) {
  const [pick, setPick] = useState<"A" | "D" | "B" | null>(initial?.pick ?? null);
  const [stake, setStake] = useState<number>(initial?.stake ?? 0);
  // Direct text entry for the stake (stakes get large; the stepper alone is
  // tedious). `stakeDraft` holds what's in the box while it's focused; out of
  // focus the box just shows the canonical clamped value.
  const [stakeEditing, setStakeEditing] = useState(false);
  const [stakeDraft, setStakeDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  // Source of truth for "what's locked in on the server right now". Starts as
  // the initial server prop and is updated locally on each successful save so
  // the button can compare current selection against the last known saved
  // state (and disable when there's nothing new to submit).
  const [savedPick, setSavedPick] = useState<ExistingPick>(initial);
  const [now, setNow] = useState<number>(() => Date.now());
  const guard = useUnsavedPickGuard();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Headline total never moves with the slider. What you can put on THIS match
  // = total minus what's tied up in other unsettled games; this match's own
  // existing stake stays re-allocatable (it isn't in committedElsewhere).
  const totalWcc = availableWcc;
  const budget = Math.max(0, totalWcc - committedElsewhere);
  const stakeCapped = Math.min(stake, budget);
  // Total minus everything staked across all games (incl. this slider). This is
  // the number that responds to the stepper - the headline stays put.
  const remainingToStake = Math.max(0, budget - stakeCapped);
  // Comeback multiplier: a correct pick pays floor((1 + 2*stake) * stakeMult).
  // Mirrors settle_match_picks exactly (half-up). stakeMult is 1 when not behind
  // or the feature is off, so this reduces to the old 1 + 2*stake.
  const hasComeback = stakeMult > 1;
  // A correct pick returns your stake times your comeback multiplier, plus 1.
  // Mirrors settle_match_picks (scripts/016) exactly, half-up.
  const payout = Math.floor(stakeCapped * stakeMult + 0.5) + 1;
  const minsToLock = Math.floor((new Date(locksAt).getTime() - now) / 60_000);
  const locked = minsToLock < 0;
  const matchesSaved =
    !!savedPick &&
    savedPick.pick === pick &&
    savedPick.stake === stakeCapped;
  const isDirty = !locked && !!pick && !matchesSaved;

  useEffect(() => {
    guard?.setDirty(isDirty);
  }, [guard, isDirty]);

  useEffect(() => {
    if (!guard) return;
    guard.registerLockPick(async () => {
      if (!pick || locked || matchesSaved) return true;
      setErr(null);
      const submitted = { pick, stake: stakeCapped };
      const res = await placePickAction({
        matchId,
        pick: submitted.pick,
        stake: submitted.stake,
      });
      if ("error" in res) {
        setErr(res.error);
        return false;
      }
      setSavedPick(submitted);
      return true;
    });
    return () => guard.registerLockPick(null);
  }, [guard, pick, stakeCapped, locked, matchesSaved, matchId]);

  // Press-and-hold ramping for the stake stepper. A pointer-down steps once
  // immediately, then after a short threshold repeats on an accelerating timer
  // (slowing toward a 45ms floor). stakeRef mirrors state synchronously so each
  // repeat reads the latest value without waiting on a re-render, and the loop
  // self-stops the moment it hits a bound (0 or budget) - important since a
  // button that disables mid-hold may never fire pointer-up. The trailing click
  // after a pointer interaction is swallowed; keyboard activation (no pointer)
  // still steps once via onClick.
  const holdRef = useRef<{ stop: () => void; pointer: boolean }>({
    stop: () => {},
    pointer: false,
  });
  const stakeRef = useRef(stake);
  useEffect(() => {
    stakeRef.current = stake;
  }, [stake]);
  useEffect(() => () => holdRef.current.stop(), []);

  function stepStake(delta: number): boolean {
    const next = Math.min(budget, Math.max(0, stakeRef.current + delta));
    if (next === stakeRef.current) return false;
    stakeRef.current = next;
    setStake(next);
    return true;
  }

  function startHold(delta: number, button = 0) {
    if (button !== 0) return; // primary button / touch / pen only - not right-click
    holdRef.current.pointer = true;
    stepStake(delta);
    let delay = 400;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (!stepStake(delta)) return; // hit a bound - stop repeating
      delay = Math.max(45, Math.round(delay * 0.82));
      timer = setTimeout(loop, delay);
    };
    timer = setTimeout(loop, 400);
    holdRef.current.stop = () => clearTimeout(timer);
  }

  function endHold() {
    holdRef.current.stop();
    holdRef.current.stop = () => {};
  }

  function clickStake(delta: number) {
    // Pointer path already stepped on pointer-down; swallow its trailing click.
    // Keyboard (Enter/Space) fires click with no preceding pointer-down.
    if (holdRef.current.pointer) {
      holdRef.current.pointer = false;
      return;
    }
    stepStake(delta);
  }

  // Typed stake: keep digits only, clamp to [0, budget]. The box reflects the
  // clamp (typing past your budget snaps to the max) and may be momentarily
  // empty while editing - an empty box commits as 0.
  function typeStake(raw: string) {
    const digits = raw.replace(/\D/g, "");
    const n = digits === "" ? 0 : Math.min(budget, parseInt(digits, 10));
    setStakeDraft(digits === "" ? "" : String(n));
    stakeRef.current = n;
    setStake(n);
  }

  function submit() {
    if (!pick) {
      setErr("pick a side first");
      return;
    }
    setErr(null);
    const submitted = { pick, stake: stakeCapped };
    startTransition(async () => {
      const res = await placePickAction({
        matchId,
        pick: submitted.pick,
        stake: submitted.stake,
      });
      if ("error" in res) setErr(res.error);
      else setSavedPick(submitted);
    });
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
        onClick={() => !locked && setPick(value)}
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
          <span className="caps-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Stake
            <InfoChip label="How does staking work?">
              <strong>Risk WCC to win more WCC.</strong>
              <br />
              Stake <em>X</em> on your pick. If you&apos;re right you get back <strong>X × your multiplier, + 1</strong>. If wrong, you lose the stake. A no-stake correct pick still wins 1.
              <br />
              <strong>Comeback multiplier:</strong> the further behind you are, the higher it climbs (up to <strong>2×</strong>) - so a behind player&apos;s 100 stake can return ~200, while near the top it&apos;s ~1× (a correct stake roughly breaks even). Your rate locks in at kickoff.
            </InfoChip>
            {hasComeback ? (
              <span className="badge" style={{ background: "var(--pitch)", color: "var(--foam-lit)", fontSize: 9, padding: "2px 7px" }}>
                comeback ×{stakeMult.toFixed(1)}
              </span>
            ) : null}
          </span>
          <span className="t-small muted">Stake WCC to win more WCC</span>
        </div>

        <div className="balance-banner">
          <span className="bal-icon"><WccIcon size={20} /></span>
          <div className="bal-text">
            <div className="t-small muted">You have</div>
            <div className="t-h1 tnum">
              {totalWcc} <span className="t-small muted">WCC</span>
            </div>
          </div>
          <div className="bal-right t-small muted">
            <span className="tnum">{remainingToStake}</span> remaining to stake
          </div>
        </div>

        <div className="card well" style={{ marginTop: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div className="t-small muted">Your stake</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span className="cur-tag">
                  <WccIcon size={18} />
                  <span className="t-h1 tnum">{stakeCapped}</span>
                </span>
              </div>
            </div>
            <div className="stepper">
              <button
                type="button"
                onClick={() => clickStake(-1)}
                onPointerDown={(e) => startHold(-1, e.button)}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                disabled={stake <= 0 || pending || locked}
                aria-label="Decrease stake"
              >
                −
              </button>
              <input
                className="value tnum"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Stake amount"
                disabled={pending || locked}
                value={stakeEditing ? stakeDraft : String(stakeCapped)}
                onFocus={(e) => {
                  setStakeEditing(true);
                  setStakeDraft(String(stakeCapped));
                  e.currentTarget.select();
                }}
                onChange={(e) => typeStake(e.target.value)}
                onBlur={() => setStakeEditing(false)}
                style={{
                  width: 64,
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  padding: 0,
                  color: "var(--stout)",
                }}
              />
              <button
                type="button"
                onClick={() => clickStake(1)}
                onPointerDown={(e) => startHold(1, e.button)}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                disabled={stake >= budget || pending || locked}
                aria-label="Increase stake"
              >
                +
              </button>
            </div>
          </div>

          <div className="payout-preview">
            <div className="pp-row pp-win">
              <span className="pp-label">If right</span>
              <span className="pp-value tnum">
                +{payout} <WccIcon size={13} />
              </span>
              <span className="pp-formula">
                {stakeCapped > 0 ? `${stakeCapped} ×${stakeMult.toFixed(1)} + 1` : "+1"}
              </span>
            </div>
            <div className={`pp-row pp-lose ${stakeCapped === 0 ? "is-dim" : ""}`}>
              <span className="pp-label">If wrong</span>
              <span className="pp-value tnum">
                {stakeCapped > 0 ? <>−{stakeCapped} <WccIcon size={13} /></> : "0"}
              </span>
              <span className="pp-formula">
                {stakeCapped > 0 ? "stake lost" : "no risk"}
              </span>
            </div>
            {stakeCapped > 0 ? (
              <div className="pp-row pp-skip">
                <span className="pp-label">Or skip stake</span>
                <span className="pp-value tnum">
                  +1 <WccIcon size={13} />
                </span>
                <span className="pp-formula">no risk</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {err ? (
        <div className="t-small" style={{ color: "var(--penalty)" }}>{err}</div>
      ) : null}

      {(() => {
        const canSubmit = !pending && !locked && !!pick && !matchesSaved;
        const label = pending
          ? "Locking..."
          : savedPick
            ? "Update pick"
            : "Lock pick";
        return (
          <button
            className="btn primary block"
            onClick={submit}
            disabled={!canSubmit}
            style={
              canSubmit && pick && pick !== "D"
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
            {label}
          </button>
        );
      })()}
    </div>
  );
}
