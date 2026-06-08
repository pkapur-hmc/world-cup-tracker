"use client";

import { useState, useTransition } from "react";
import { pourAction } from "./actions";
import type { CountryBeer } from "@/data/country-beers";

export function BeerStampRail({
  matchId,
  countryCode,
  countryName,
  flag,
  beers,
  claimedNames,
}: {
  matchId: number;
  countryCode: string;
  countryName: string;
  flag: string;
  beers: CountryBeer[];
  claimedNames: Set<string>;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const remaining = beers.filter((b) => !claimedNames.has(b.name)).length;

  function stamp(beer: CountryBeer) {
    setErr(null);
    setBusy(beer.name);
    startTransition(async () => {
      const res = await pourAction({
        matchId,
        countryCode,
        beerLabel: beer.name,
      });
      if ("error" in res) setErr(res.error);
      setBusy(null);
    });
  }

  return (
    <div>
      <div className="section-label">
        <span className="caps-label">
          🛂 Stamp {countryName} {flag}
        </span>
        <span className="t-small muted">
          {remaining} of {beers.length} left
        </span>
      </div>
      <div className="h-scroll">
        {beers.map((b) => {
          const claimed = claimedNames.has(b.name);
          const isBusy = busy === b.name && pending;
          const findHref = `https://www.google.com/search?q=${encodeURIComponent(`${b.name} beer near me`)}`;
          return (
            <div
              key={b.name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                flex: "0 0 auto",
              }}
            >
              <button
                type="button"
                onClick={() => stamp(b)}
                disabled={isBusy}
                aria-label={`Pour ${b.name}, stamp ${countryName}`}
                className={`beer-chip ${claimed ? "claimed" : ""}`}
                style={{
                  cursor: "pointer",
                  font: "inherit",
                  color: "inherit",
                  opacity: isBusy ? 0.5 : 1,
                }}
              >
                <span className="bottle" />
                <span className="name">{prettyBeerName(b.name)}</span>
              </button>
              <a
                href={findHref}
                target="_blank"
                rel="noopener noreferrer"
                className="t-small"
                style={{
                  color: "var(--burn)",
                  textDecoration: "none",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                Find →
              </a>
            </div>
          );
        })}
      </div>
      {err ? (
        <div className="t-small" style={{ color: "var(--penalty)", marginTop: 6 }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}

function prettyBeerName(name: string): React.ReactNode {
  const idx = name.indexOf(" ");
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <br />
      {name.slice(idx + 1)}
    </>
  );
}
