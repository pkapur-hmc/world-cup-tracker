"use client";

import { useRef, useState, useTransition } from "react";
import { pourAction, undoLastBasicForMatchAction } from "./actions";
import { WccIcon } from "@/components/ui/CurrencyIcon";

/**
 * Match-drink stepper. Big number = total drinks this match (basic + country
 * combined). Breakdown below splits it. Buttons act on the BASIC bucket only;
 * country-specific drinks are added/removed in the BeerStampRail sheet.
 *
 * `countryCount` is owned by the server-rendered page and passed in fresh each
 * render. We track only the basic bucket locally so the +1 / −1 buttons feel
 * immediate without having to sync country state across components.
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
  const [basicCount, setBasicCount] = useState(() => toNum(initialBasicCount));
  const [totalOptim, setTotalOptim] = useState(() => toNum(totalAllTime));
  const plusRef = useRef<HTMLButtonElement>(null);

  const country = toNum(countryCount);
  const matchTotal = basicCount + country;

  function plus() {
    setErr(null);
    setBasicCount((c) => c + 1);
    setTotalOptim((c) => c + 1);
    spawnFoamBubble(plusRef.current);
    startTransition(async () => {
      const res = await pourAction({ matchId });
      if ("error" in res) {
        setBasicCount((c) => Math.max(0, c - 1));
        setTotalOptim((c) => Math.max(0, c - 1));
        setErr(res.error);
      }
    });
  }

  function minus() {
    setErr(null);
    if (basicCount <= 0) {
      setErr("no basic drinks to remove (country beers use the section below)");
      return;
    }
    setBasicCount((c) => Math.max(0, c - 1));
    setTotalOptim((c) => Math.max(0, c - 1));
    startTransition(async () => {
      const res = await undoLastBasicForMatchAction(matchId);
      if ("error" in res) {
        setBasicCount((c) => c + 1);
        setTotalOptim((c) => c + 1);
        setErr(res.error);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
          <div className="sub-meta tnum">{totalOptim} total all-time</div>
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
