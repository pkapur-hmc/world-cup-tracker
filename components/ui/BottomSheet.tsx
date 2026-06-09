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
 * tap-to-dismiss, drag-handle-down to close, ESC to close.
 *
 * Mobile-first patterns:
 *   - max-height uses 100dvh + safe-area-inset-top so the title never sits
 *     under the iOS status bar / notch.
 *   - scrolling is scoped to .sheet-body with overscroll-behavior: contain,
 *     so a fast scroll inside the sheet never chains into the page behind.
 *   - body scroll is locked with position:fixed (iOS-Safari safe); scroll
 *     position is preserved and restored on close.
 *   - when closed, visibility flips to hidden AFTER the slide-down animation
 *     completes, so the closed sheet contributes nothing to compositing/
 *     touch routing and can't cause post-dismiss scroll choppiness.
 *   - drag uses pointer events with explicit pointer-capture release on
 *     pointerup/pointercancel so a dropped gesture can't strand capture.
 */
/** Slide-down transition duration on .sheet (keep in sync with CSS). */
const CLOSE_TRANSITION_MS = 300;

export function BottomSheet({ open, onClose, title, children, accent, bg }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  // onClose can change identity each render; capture latest via ref so the
  // document-level drag listeners always call the current callback without
  // re-binding on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Body scroll lock — fix position so iOS Safari can't rubber-band the page
  // behind the sheet. Preserve and restore the scroll offset around it.
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // When the sheet finishes closing, clear any inline drag-transform so the
  // next open starts clean. Delay just past the slide-down so the animation
  // can play out from the drag position before we wipe the inline style.
  useEffect(() => {
    if (open || !sheetRef.current) return;
    const el = sheetRef.current;
    const t = setTimeout(() => {
      el.style.transform = "";
    }, CLOSE_TRANSITION_MS + 40);
    return () => clearTimeout(t);
  }, [open]);

  function onPointerDown(e: React.PointerEvent) {
    if (!e.isPrimary) return;
    // Use document-level pointermove/pointerup listeners rather than React
    // pointer capture. iOS Safari is inconsistent about delivering touch
    // pointermove events to a captured element when the finger leaves the
    // element's bounds — document listeners always fire. This is the pattern
    // used by Vaul / Radix Dialog drawer.
    const startY = e.clientY;
    let delta = 0;

    function move(ev: PointerEvent) {
      const dy = ev.clientY - startY;
      if (dy <= 0 || !sheetRef.current) return;
      // Resistance past 200px so a long drag doesn't fling off the screen.
      const damped = dy < 200 ? dy : 200 + (dy - 200) * 0.4;
      sheetRef.current.style.transform = `translateY(${damped}px)`;
      delta = dy;
    }
    function end() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", cancel);
      const shouldClose = delta > 80;
      if (shouldClose) {
        // Continue the animation smoothly from the drag position to fully
        // off-screen. Matches the CSS [data-state="closed"] target so once
        // the state flips below, there's no second animation, no snap.
        if (sheetRef.current) {
          sheetRef.current.style.transform = "translateY(110%)";
        }
        onCloseRef.current();
      } else {
        // Snap back to fully open by clearing the inline transform; CSS
        // [data-state="open"] rule (translateY(0)) takes over.
        if (sheetRef.current) {
          sheetRef.current.style.transform = "";
        }
      }
    }
    function cancel() {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", cancel);
      if (sheetRef.current) sheetRef.current.style.transform = "";
    }

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", cancel);
  }

  return (
    <div
      className="sheet-root"
      data-state={open ? "open" : "closed"}
      aria-hidden={!open}
    >
      <button
        className="sheet-backdrop"
        onClick={onClose}
        aria-label="Close"
        tabIndex={open ? 0 : -1}
      />
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
        >
          <div className="sheet-handle" style={accent ? { background: accent } : undefined} />
        </div>
        {title ? <div className="sheet-title">{title}</div> : null}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
