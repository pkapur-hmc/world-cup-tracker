"use client";

import { useSyncExternalStore } from "react";

export type LocalTimeMode =
  | "time" // 7:00 PM
  | "dayShort" // Today / Tomorrow / Yesterday / Thu, Jun 11
  | "dayLong" // Today / Tomorrow / Yesterday / Thursday, Jun 11
  | "dateShort"; // Jun 8

/**
 * Render a UTC ISO timestamp in the viewer's local timezone. The kickoff_at
 * field is stored in UTC, but server-side formatting would pin every user to
 * the Vercel function region's clock.
 *
 * Uses useSyncExternalStore so SSR + the first client render both produce a
 * deterministic UTC string (no hydration mismatch), then React swaps to the
 * local-zone string on the next client render. No effect-driven setState.
 */
export function LocalTime({
  iso,
  mode,
  className,
}: {
  iso: string;
  mode: LocalTimeMode;
  className?: string;
}) {
  const text = useSyncExternalStore(
    subscribe,
    () => format(iso, mode, undefined),
    () => format(iso, mode, "UTC"),
  );
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

// No client-side store changes drive a re-render here; the user's timezone
// doesn't shift mid-session. useSyncExternalStore still gives us the right
// SSR/post-hydration two-phase behavior with a no-op subscribe.
function subscribe(): () => void {
  return () => {};
}

function format(iso: string, mode: LocalTimeMode, tz: string | undefined): string {
  const d = new Date(iso);
  switch (mode) {
    case "time":
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: tz,
      });
    case "dateShort":
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: tz,
      });
    case "dayShort":
      return dayLabel(d, tz, false);
    case "dayLong":
      return dayLabel(d, tz, true);
  }
}

function dayLabel(d: Date, tz: string | undefined, long: boolean): string {
  const now = new Date();
  const dKey = ymd(d, tz);
  if (dKey === ymd(now, tz)) return "Today";
  if (dKey === ymd(new Date(now.getTime() + 86_400_000), tz)) return "Tomorrow";
  if (dKey === ymd(new Date(now.getTime() - 86_400_000), tz)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: long ? "long" : "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
}

// en-CA gives YYYY-MM-DD which is convenient for equality comparison.
function ymd(d: Date, tz: string | undefined): string {
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  });
}
