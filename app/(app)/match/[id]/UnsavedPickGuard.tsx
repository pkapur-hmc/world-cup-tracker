"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Match } from "@/lib/fixtures";
import { matchPhase } from "@/lib/match-phase";
import { BottomSheet } from "@/components/ui/BottomSheet";

type LockPickFn = () => Promise<boolean>;

type UnsavedPickContextValue = {
  setDirty: (dirty: boolean) => void;
  registerLockPick: (fn: LockPickFn | null) => void;
};

const UnsavedPickContext = createContext<UnsavedPickContextValue | null>(null);

export function useUnsavedPickGuard() {
  return useContext(UnsavedPickContext);
}

export function UnsavedPickProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const lockPickRef = useRef<LockPickFn | null>(null);

  const registerLockPick = useCallback((fn: LockPickFn | null) => {
    lockPickRef.current = fn;
  }, []);

  return (
    <UnsavedPickContext.Provider value={{ setDirty, registerLockPick }}>
      <UnsavedPickBackGuard dirty={dirty} lockPickRef={lockPickRef}>
        {children}
      </UnsavedPickBackGuard>
    </UnsavedPickContext.Provider>
  );
}

function UnsavedPickBackGuard({
  dirty,
  lockPickRef,
  children,
}: {
  dirty: boolean;
  lockPickRef: React.RefObject<LockPickFn | null>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [locking, setLocking] = useState(false);

  const navigateBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  const requestBack = useCallback(() => {
    if (dirty) setConfirmOpen(true);
    else navigateBack();
  }, [dirty, navigateBack]);

  const handleLockAndLeave = useCallback(async () => {
    const lock = lockPickRef.current;
    if (!lock) {
      setConfirmOpen(false);
      navigateBack();
      return;
    }
    setLocking(true);
    try {
      const ok = await lock();
      if (ok) {
        setConfirmOpen(false);
        navigateBack();
      }
    } finally {
      setLocking(false);
    }
  }, [lockPickRef, navigateBack]);

  const handleLeaveWithoutSaving = useCallback(() => {
    setConfirmOpen(false);
    navigateBack();
  }, [navigateBack]);

  return (
    <BackNavigationContext.Provider value={{ requestBack }}>
      {children}
      <BottomSheet
        open={confirmOpen}
        onClose={() => !locking && setConfirmOpen(false)}
        title="Lock your pick?"
      >
        <p className="t-body muted" style={{ marginBottom: 16 }}>
          You&apos;ve chosen a side but haven&apos;t locked it in yet. Lock your pick
          before leaving, or go back without saving.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            type="button"
            className="btn primary block"
            disabled={locking}
            onClick={() => void handleLockAndLeave()}
          >
            {locking ? "Locking..." : "Lock pick"}
          </button>
          <button
            type="button"
            className="btn ghost block"
            disabled={locking}
            onClick={handleLeaveWithoutSaving}
          >
            Leave without saving
          </button>
          <button
            type="button"
            className="btn secondary block"
            disabled={locking}
            onClick={() => setConfirmOpen(false)}
          >
            Stay on match
          </button>
        </div>
      </BottomSheet>
    </BackNavigationContext.Provider>
  );
}

const BackNavigationContext = createContext<{ requestBack: () => void } | null>(
  null,
);

export function GuardedMatchAppbar({ match }: { match: Match }) {
  const nav = useContext(BackNavigationContext);
  const stageLabel =
    match.stage === "group"
      ? `Group ${match.group_letter ?? ""}`
      : match.stage.toUpperCase();

  return (
    <div className="appbar" style={{ paddingBottom: 6 }}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Back"
        onClick={() => nav?.requestBack()}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div style={{ flex: 1 }}>
        <div className="caps-label">
          {stageLabel} · M{match.id}
        </div>
      </div>
      {matchPhase(match) === "live" ? (
        <span className="badge live">
          <span className="dot" />
          Live
        </span>
      ) : null}
    </div>
  );
}
