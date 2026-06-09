"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { pourAction, undoLastBasicForMatchAction } from "./actions";
import { WccIcon } from "@/components/ui/CurrencyIcon";

/**
 * Match-drink stepper. Big number = total drinks this match (basic + country
 * combined). Breakdown below splits it. Buttons act on the BASIC bucket only;
 * country-specific drinks are added/removed in the BeerStampRail sheet.
 *
 * useOptimistic gives us instant +/- feedback while server actions run.
 * Once the transition wraps up (revalidatePath re-renders this component with
 * fresh props), the optimistic delta is automatically discarded and the new
 * server values become the source of truth. That same mechanism is what
 * picks up country-beer pours from BeerStampRail.
 */
export function PourButton({
  matchId,
  initialBasicCount,
  countryCount,
  totalAllTime,
}: {
  matchId: number;
  initialBasicCount: number;
  countryCount: number;
  totalAllTime: number;
}) {
  const toNum = (n: number | undefined | null) =>
    Number.isFinite(Number(n)) ? Number(n) : 0;
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const plusRef = useRef<HTMLButtonElement>(null);

  // One reducer drives both displays: the basic count for this match, and the
  // all-time total. A basic +/- moves both by ±1. The country count comes
  // straight from props (BeerStampRail owns its own optimistic state and we
  // pick up the new prop after revalidation).
  const [basicCount, applyBasicDelta] = useOptimistic(
    toNum(initialBasicCount),
    (cur, delta: 1 | -1) => Math.max(0, cur + delta),
  );
  const [totalDrinks, applyTotalDelta] = useOptimistic(
    toNum(totalAllTime),
    (cur, delta: 1 | -1) => Math.max(0, cur + delta),
  );

  const country = toNum(countryCount);
  const matchTotal = basicCount + country;

  function plus() {
    setErr(null);
    spawnFoamBubble(plusRef.current);
    startTransition(async () => {
      applyBasicDelta(1);
      applyTotalDelta(1);
      const res = await pourAction({ matchId });
      if ("error" in res) setErr(res.error);
    });
  }

  function minus() {
    setErr(null);
    if (basicCount <= 0) {
      setErr("no basic drinks to remove (country beers use the section below)");
      return;
    }
    startTransition(async () => {
      applyBasicDelta(-1);
      applyTotalDelta(-1);
      const res = await undoLastBasicForMatchAction(matchId);
      if ("error" in res) setErr(res.error);
    });
  }

  const isFirstEver = totalDrinks === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {isFirstEver ? (
        <div className="first-pour-hint">
          <span aria-hidden style={{ fontSize: 18 }}>🍺</span>
          <div>
            <div className="t-sub" style={{ fontSize: 13 }}>Your first pour earns +1 WCC.</div>
            <div className="t-small muted">
              Try a country beer below for +2 WCC and a 🛂 passport stamp.
            </div>
          </div>
        </div>
      ) : null}
      <div className="pour-stepper">
        <button
          type="button"
          className="pour-btn-circle minus"
          onClick={minus}
          disabled={pending || basicCount <= 0}
          aria-label="Remove last basic drink"
        >
          −1
        </button>
        <div className="core">
          <div className="label-row">
            <WccIcon size={16} /> Drinks this match
          </div>
          <div className="big-num tnum">{matchTotal}</div>
          <div className="match-breakdown tnum">
            <span className={basicCount > 0 ? "" : "dim"}>
              <span className="bd-dot bd-basic" /> {basicCount} basic
            </span>
            <span className="bd-sep">·</span>
            <span className={country > 0 ? "" : "dim"}>
              <span className="bd-dot bd-country" /> {country} country
            </span>
          </div>
          <div className="sub-meta tnum">{totalDrinks} total all-time</div>
        </div>
        <button
          ref={plusRef}
          type="button"
          className="pour-btn-circle plus"
          onClick={plus}
          disabled={pending}
          aria-label="Log a basic drink"
        >
          +1
        </button>
      </div>
      <div className="t-small muted" style={{ textAlign: "center" }}>
        +1 / −1 tracks <strong>basic</strong> drinks. Use the country section below for specific beers.
      </div>
      {err ? (
        <div className="t-small" style={{ color: "var(--penalty)", textAlign: "center" }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}

function spawnFoamBubble(host: HTMLElement | null) {
  if (!host) return;
  host.style.transform = "scale(1.06)";
  setTimeout(() => {
    if (host) host.style.transform = "";
  }, 160);

  const rect = host.getBoundingClientRect();
  const bubble = document.createElement("div");
  const jitter = (Math.random() - 0.5) * 24;
  Object.assign(bubble.style, {
    position: "fixed",
    left: `${rect.left + rect.width / 2 - 8 + jitter}px`,
    top: `${rect.top + rect.height / 2 - 8}px`,
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "var(--foam-lit)",
    border: "1.5px solid var(--stout)",
    pointerEvents: "none",
    opacity: "0.95",
    transition: "transform 600ms ease-out, opacity 600ms ease-out",
    zIndex: "60",
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(bubble);
  requestAnimationFrame(() => {
    bubble.style.transform = "translateY(-120px) scale(0.6)";
    bubble.style.opacity = "0";
  });
  setTimeout(() => bubble.remove(), 640);
}
