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
  beerMult = 1,
}: {
  matchId: number;
  initialBasicCount: number;
  countryCount: number;
  totalAllTime: number;
  /** Comeback multiplier for country beers (basic drinks stay flat at 1). */
  beerMult?: number;
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
  // WCC headline: basic drink 1 (flat), country beer 2*beerMult (comeback bonus).
  const countryWcc = Math.floor(2 * beerMult + 0.5);
  const matchWcc = basicCount + country * countryWcc;

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
          <span aria-hidden style={{ fontSize: 18 }}>
            🍺
          </span>
          <div>
            <div className="t-sub" style={{ fontSize: 13 }}>
              Drinking right now? Tap below to log it — +1 WCC each.
            </div>
            <div className="t-small muted">
              Drinking a specific country&apos;s beer? Use the section below for
              +{countryWcc} WCC + 🛂 stamp.
            </div>
          </div>
        </div>
      ) : null}

      {/* The primary action on the match: log whatever you're drinking. Built to
          read like the country-beer launcher below it, but in the headline amber
          so it's unmistakably THE tap target. The whole card is the button. */}
      <button
        type="button"
        className="log-drink-launcher"
        onClick={plus}
        disabled={pending}
        aria-label="Log one drink (+1 WCC)"
      >
        <span className="ldl-lead">
          <span className="ldl-icon" aria-hidden>🍺</span>
          <span className="ldl-text">
            <span className="ldl-title">Log a drink</span>
            <span className="ldl-sub">Any beer, wine or cocktail · +1 WCC each</span>
          </span>
        </span>
        <span className="ldl-add">
          {basicCount > 0 ? <span className="ldl-count tnum">×{basicCount}</span> : null}
          <span className="ldl-plus" ref={plusRef} aria-hidden>+1</span>
        </span>
      </button>

      <div className="pour-footer">
        <button
          type="button"
          className="pour-undo"
          onClick={minus}
          disabled={pending || basicCount <= 0}
          aria-label="Undo last logged drink"
        >
          ↶ Undo last
        </button>
        <span className="pour-readout tnum">
          <WccIcon size={13} /> {matchWcc} WCC · {matchTotal} drink
          {matchTotal === 1 ? "" : "s"} this match
        </span>
      </div>

      {err ? (
        <div
          className="t-small"
          style={{ color: "var(--penalty)", textAlign: "center" }}
        >
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
