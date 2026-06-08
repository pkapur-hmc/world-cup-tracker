/** Public origin for share/invite links.
 *  Preference order:
 *    1. NEXT_PUBLIC_APP_URL (canonical production hostname, e.g. https://wcc.app)
 *    2. NEXT_PUBLIC_VERCEL_URL (Vercel-provided preview/prod URL, without scheme)
 *    3. window.location.origin (current tab's origin, SSR-safe via the guard)
 *    4. "" (placeholder during SSR; client re-renders pick up the real one)
 *
 *  Set NEXT_PUBLIC_APP_URL in Vercel project env vars to whatever URL you
 *  want invites pasted into iMessage/WhatsApp/Slack to use.
 */
export function appOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
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
