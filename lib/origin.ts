/** Public origin for share/invite links.
 *  Preference order:
 *    1. NEXT_PUBLIC_SITE_URL (canonical hostname, e.g. https://world-cup-tracker-swart.vercel.app)
 *    2. NEXT_PUBLIC_VERCEL_URL (Vercel-provided per-deployment URL, without scheme)
 *    3. window.location.origin (current tab's origin, SSR-safe via the guard)
 *    4. "" (placeholder during SSR; client re-renders pick up the real one)
 */
export function appOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const fromVercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (fromVercel) {
    return fromVercel.startsWith("http") ? fromVercel.replace(/\/$/, "") : `https://${fromVercel}`;
  }

  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Convenience: full invite URL for a bracket. */
export function inviteUrlFor(code: string): string {
  const origin = appOrigin();
  return origin ? `${origin}/join/${code}` : `/join/${code}`;
}

/** The full invite message used by every share/copy surface. Includes the
 *  link AND the raw code, since the deep link doesn't always open (some
 *  in-app browsers / link previews swallow it) - the code is the reliable
 *  fallback: open the app, Join with code, paste. */
export function inviteShareText(groupName: string, code: string): string {
  return [
    `Hop into "${groupName}" - our World Cup Cup bracket for the 2026 tournament.`,
    ``,
    `Tap to join: ${inviteUrlFor(code)}`,
    ``,
    `Link not working? Open the app, tap "Join with code", and paste: ${code}`,
  ].join("\n");
}
