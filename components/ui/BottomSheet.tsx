"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Optional accent color band on the grab-handle (matches an action color). */
  accent?: string;
  /** Optional background color override for the whole sheet body. */
  bg?: string;
};

/**
 * App-wide bottom sheet. Slides up from the bottom edge, dim backdrop,
 * tap-to-dismiss, swipe-down (drag the handle) to close, ESC to close.
 *
 * Designed for short flows: confirmation, settings, quick actions.
 * Not a generic dialog - keep one canonical UI for sheets.
 */
export function BottomSheet({ open, onClose, title, children, accent, bg }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDelta = useRef(0);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  function onPointerDown(e: React.PointerEvent) {
    dragStartY.current = e.clientY;
    dragDelta.current = 0;
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStartY.current == null) return;
    const dy = e.clientY - dragStartY.current;
    if (dy > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      dragDelta.current = dy;
    }
  }
  function onPointerUp() {
    if (sheetRef.current) sheetRef.current.style.transform = "";
    if (dragDelta.current > 80) onClose();
    dragStartY.current = null;
    dragDelta.current = 0;
  }

  return (
    <div className={`sheet-root ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="sheet-backdrop" onClick={onClose} aria-label="Close" tabIndex={open ? 0 : -1} />
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Sheet"}
        style={
          bg
            ? {
                // Layer the tint OVER the opaque foam base so semi-transparent
                // bg values still hide the page behind the sheet.
                background: `linear-gradient(${bg}, ${bg}), var(--foam)`,
              }
            : undefined
        }
      >
        <div
          className="sheet-handle-zone"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="sheet-handle" style={accent ? { background: accent } : undefined} />
        </div>
        {title ? <div className="sheet-title">{title}</div> : null}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
