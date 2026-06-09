"use client";

import { useState, useTransition } from "react";
import { pourAction, undoLastBeerAction } from "./actions";
import type { CountryBeer } from "@/data/country-beers";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CountryBottle } from "@/components/ui/CountryBottle";
import { colorFor } from "@/data/country-colors";

/**
 * Country-beer "launcher" + confirm sheet.
 *
 * Why: tapping a beer chip directly was too easy to mis-add. The country flow
 * is now intentional - open the sheet, find the beer, tap + to add, tap - to
 * remove. Quick basic drinks live on the PourButton stepper above.
 */
export function BeerStampRail({
  matchId,
  countryCode,
  countryName,
  flag,
  beers,
  claimedNames,
  matchCounts,
}: {
  matchId: number;
  countryCode: string;
  countryName: string;
  flag: string;
  beers: CountryBeer[];
  claimedNames: Set<string>;
  matchCounts: Map<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {};
    for (const b of beers) o[b.name] = matchCounts.get(b.name) ?? 0;
    return o;
  });

  const totalThisMatch = Object.values(counts).reduce((a, b) => a + b, 0);
  const accent = colorFor(countryCode);

  function bumpUp(beer: CountryBeer) {
    setErr(null);
    setBusy(beer.name);
    setCounts((c) => ({ ...c, [beer.name]: (c[beer.name] ?? 0) + 1 }));
    startTransition(async () => {
      const res = await pourAction({
        matchId,
        countryCode,
        beerLabel: beer.name,
      });
      if ("error" in res) {
        setCounts((c) => ({ ...c, [beer.name]: Math.max(0, (c[beer.name] ?? 1) - 1) }));
        setErr(res.error);
      }
      setBusy(null);
    });
  }

  function bumpDown(beer: CountryBeer) {
    setErr(null);
    if ((counts[beer.name] ?? 0) <= 0) return;
    setBusy(beer.name);
    setCounts((c) => ({ ...c, [beer.name]: Math.max(0, (c[beer.name] ?? 0) - 1) }));
    startTransition(async () => {
      const res = await undoLastBeerAction({
        matchId,
        countryCode,
        beerLabel: beer.name,
      });
      if ("error" in res) {
        setCounts((c) => ({ ...c, [beer.name]: (c[beer.name] ?? 0) + 1 }));
        setErr(res.error);
      }
      setBusy(null);
    });
  }

  return (
    <>
      <button
        type="button"
        className="country-beer-launcher"
        onClick={() => setOpen(true)}
        aria-label={`Open ${countryName} beer sheet`}
        style={{
          background: accent.tint,
          borderColor: accent.primary,
          borderLeft: `4px solid ${accent.primary}`,
        }}
      >
        <div className="cbl-lead">
          <span className="cbl-flag" aria-hidden>{flag}</span>
          <div>
            <div className="cbl-title">{countryName} beers</div>
            <div className="cbl-sub">
              {totalThisMatch > 0
                ? `${totalThisMatch} logged · +${totalThisMatch * 2} WCC 🛂`
                : "+2 WCC + 🛂 stamp each"}
            </div>
          </div>
        </div>
        <span className="cbl-count">
          {totalThisMatch > 0 ? <>×{totalThisMatch}</> : null}
          <span className="chev">›</span>
        </span>
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={`${flag} ${countryName} beers`}
        accent={accent.primary}
        bg={accent.tint}
      >
        <div
          style={{
            margin: "-4px -20px 0",
            padding: "10px 20px 14px",
            background: `linear-gradient(180deg, ${accent.tint2} 0%, transparent 100%)`,
            borderTop: `3px solid ${accent.primary}`,
            borderBottom: `1px solid ${accent.secondary}`,
            color: accent.ink,
          }}
        >
          <div className="t-small">
            Tap + to log a drink, − to remove.{" "}
            <strong>Each {countryName} beer is worth 2 WCC.</strong>
          </div>
        </div>
        {beers.map((b) => {
          const c = counts[b.name] ?? 0;
          const stamped = claimedNames.has(b.name) || c > 0;
          const findHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`"${b.name}" near me`)}`;
          return (
            <div
              key={b.name}
              className="sheet-confirm-row"
              style={{
                background: c > 0 ? accent.tint2 : "var(--foam-lit)",
                borderLeft: `3px solid ${c > 0 ? accent.primary : "transparent"}`,
                borderRight: c > 0 ? `1px solid ${accent.secondary}` : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <CountryBottle countryCode={countryCode} flag={flag} size={48} />
                <div style={{ minWidth: 0 }}>
                  <div className="t-sub" style={{ fontSize: 15 }}>{b.name}</div>
                  <div className="t-small muted">
                    {b.style}
                    {stamped ? " · 🛂 stamped" : ""}
                    {" · "}
                    <a
                      href={findHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--burn)", fontWeight: 700, textDecoration: "none" }}
                    >
                      find a bar →
                    </a>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="pour-btn-circle minus"
                  style={{
                    width: 40,
                    height: 40,
                    fontSize: 20,
                    borderWidth: 1.5,
                    background: accent.tint2,
                    borderColor: accent.secondary,
                    color: accent.ink,
                  }}
                  onClick={() => bumpDown(b)}
                  disabled={(busy === b.name && pending) || c <= 0}
                  aria-label={`Remove one ${b.name}`}
                >
                  −
                </button>
                <span className="tnum" style={{ minWidth: 22, textAlign: "center", fontFamily: "var(--ff-display)", fontWeight: 800, fontSize: 20 }}>
                  {c}
                </span>
                <button
                  type="button"
                  className="pour-btn-circle plus"
                  style={{
                    width: 40,
                    height: 40,
                    fontSize: 20,
                    borderWidth: 1.5,
                    background: accent.primary,
                    borderColor: accent.primary,
                    color: readableInkOn(accent.primary),
                  }}
                  onClick={() => bumpUp(b)}
                  disabled={busy === b.name && pending}
                  aria-label={`Add one ${b.name}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
        {err ? (
          <div className="t-small" style={{ color: "var(--penalty)", paddingLeft: 4 }}>
            {err}
          </div>
        ) : null}
        <button
          type="button"
          className="btn primary block"
          onClick={() => setOpen(false)}
          style={{
            marginTop: 6,
            background: accent.primary,
            borderColor: accent.primary,
            color: readableInkOn(accent.primary),
          }}
        >
          Done
        </button>
      </BottomSheet>
    </>
  );
}

function readableInkOn(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#1C140C";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.55 ? "#1C140C" : "#FFFEF2";
}
