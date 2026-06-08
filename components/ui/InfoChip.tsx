"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Pos = { top: number; left: number; arrowLeft: number };

/**
 * Tap-target "?" with an explanation popover. Renders via portal so the
 * popover can escape `overflow: hidden` ancestors (cards, sheets) and clamp
 * itself to the viewport edges. Tap outside or Esc to close.
 */
export function InfoChip({
  label,
  size = 16,
  children,
}: {
  label: string;
  size?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);

  // Position once on open and on layout changes (resize, scroll).
  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const btn = btnRef.current;
      const pop = popRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const popW = pop?.offsetWidth ?? 260;
      const margin = 12;
      const desiredLeft = r.right - popW; // align popover right edge to button right
      const left = Math.max(
        margin,
        Math.min(desiredLeft, window.innerWidth - popW - margin),
      );
      const top = r.bottom + 8;
      const arrowLeft = Math.max(8, Math.min(r.right - left - 12, popW - 16));
      setPos({ top, left, arrowLeft });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Outside-click + Esc dismissal.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pop =
    open && typeof document !== "undefined"
      ? createPortal(
          <span
            ref={popRef}
            role="tooltip"
            className="info-chip-pop"
            style={
              pos
                ? {
                    top: pos.top,
                    left: pos.left,
                    // arrow position via CSS variable
                    ["--arrow-left" as string]: `${pos.arrowLeft}px`,
                  }
                : { opacity: 0 }
            }
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </span>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="info-chip-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={{ width: size, height: size }}
      >
        ?
      </button>
      {pop}
    </>
  );
}
