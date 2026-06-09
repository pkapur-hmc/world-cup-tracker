import Image from "next/image";
import Link from "next/link";
import { HelpButton } from "./HelpButton";

/**
 * Global brand header rendered above every in-app screen. Owns:
 *   - the mark + wordmark (tap = home)
 *   - the persistent ? help launcher
 *   - safe-area-aware top padding so screens don't sit flush to the notch.
 *
 * Per-page <div className="appbar"> below this just owns the page title.
 */
export function TopBar() {
  return (
    <div className="top-bar">
      <Link href="/" className="top-bar-brand" aria-label="Home">
        <Image src="/mark.svg" alt="" width={26} height={30} priority />
        <span className="top-bar-wordmark">World Cup Cup</span>
      </Link>
      <HelpButton />
    </div>
  );
}
