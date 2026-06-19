"use client";

import { useEffect, useState } from "react";

/**
 * Live clock badge: the in-play minute captured at the last sync, plus how
 * long ago that sync was - so it's clear the score is "as of the 64th minute,
 * synced 1 min ago" rather than dead-real-time. The "ago" ticks client-side;
 * the minute itself only moves when the page re-renders with a fresh sync.
 */
export function LiveMinute({
  minute,
  updatedAt,
}: {
  minute: string | null;
  updatedAt: string | null;
}) {
  const [ago, setAgo] = useState<string | null>(null);

  useEffect(() => {
    if (!updatedAt) return;
    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000);
      setAgo(mins <= 0 ? "just now" : mins === 1 ? "1 min ago" : `${mins} min ago`);
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [updatedAt]);

  if (!minute && !ago) return null;

  return (
    <div className="live-minute" style={{ marginTop: 10 }}>
      {minute ? (
        <span className="live-minute-clock">
          <span className="lm-dot" aria-hidden />
          {minute}
        </span>
      ) : null}
      {ago ? <span className="live-minute-ago">synced {ago}</span> : null}
    </div>
  );
}
