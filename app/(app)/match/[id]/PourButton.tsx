"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { pourAction, undoLastPourAction } from "./actions";

export function PourButton({ matchId }: { matchId: number | null }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [lastTapAt, setLastTapAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const btnRef = useRef<HTMLButtonElement>(null);

  // Tick `now` while there's a recent tap, so the undo countdown derives in render.
  useEffect(() => {
    if (lastTapAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [lastTapAt]);

  const minutesLeft =
    lastTapAt != null
      ? Math.max(0, 5 - Math.floor((now - lastTapAt) / 60_000))
      : 0;
  const showUndo = lastTapAt != null && minutesLeft > 0;

  function tap() {
    setErr(null);
    const ts = Date.now();
    setLastTapAt(ts);
    setNow(ts);
    spawnFoamBubble(btnRef.current);
    startTransition(async () => {
      const res = await pourAction({ matchId });
      if ("error" in res) setErr(res.error);
    });
  }

  function undo() {
    setErr(null);
    startTransition(async () => {
      const res = await undoLastPourAction();
      if ("error" in res) setErr(res.error);
      else setLastTapAt(null);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "8px 0 4px" }}>
      <button
        ref={btnRef}
        className="pour-btn"
        onClick={tap}
        disabled={pending}
        aria-label="Pour a WCC"
        style={{ opacity: pending ? 0.7 : 1, transition: "transform 180ms ease-out" }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span style={{ fontSize: 56, lineHeight: 0.9 }}>+1</span>
          <span className="pour-sub">WCC · Tap</span>
        </div>
      </button>
      {showUndo ? (
        <button className="link" onClick={undo} disabled={pending}>
          undo last ({minutesLeft}m left)
        </button>
      ) : null}
      {err ? (
        <div className="t-small" style={{ color: "var(--penalty)" }}>
          {err}
        </div>
      ) : null}
    </div>
  );
}

function spawnFoamBubble(host: HTMLElement | null) {
  if (!host) return;
  // Animate the button scale (no Framer Motion needed for one transform).
  host.style.transform = "scale(1.04)";
  setTimeout(() => {
    if (host) host.style.transform = "";
  }, 180);

  const rect = host.getBoundingClientRect();
  const bubble = document.createElement("div");
  const jitter = (Math.random() - 0.5) * 40;
  Object.assign(bubble.style, {
    position: "fixed",
    left: `${rect.left + rect.width / 2 - 8 + jitter}px`,
    top: `${rect.top + rect.height / 2 - 8}px`,
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    background: "var(--foam-lit)",
    border: "1.5px solid var(--stout)",
    pointerEvents: "none",
    opacity: "0.95",
    transition: "transform 600ms ease-out, opacity 600ms ease-out",
    zIndex: "60",
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(bubble);

  // Trigger transition
  requestAnimationFrame(() => {
    bubble.style.transform = "translateY(-160px) scale(0.6)";
    bubble.style.opacity = "0";
  });
  setTimeout(() => bubble.remove(), 640);
}
