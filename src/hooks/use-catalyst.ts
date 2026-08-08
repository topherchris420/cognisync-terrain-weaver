import { useCallback, useEffect, useState } from "react";
import {
  CATALYST_UNLOCK_EVENT,
  isCatalystUnlocked,
  unlockCatalyst,
} from "@/lib/catalyst";

/**
 * Whether the hidden Catalyst layer has been discovered.
 *
 * Persisted in localStorage, so the unlock is a one-time event, and mirrored
 * across every mounted component (and other tabs) so the timeline, the lens,
 * and the map skin all open together.
 */
export function useCatalystUnlocked(): [boolean, () => void] {
  const [unlocked, setUnlocked] = useState(false);

  // Read after mount: localStorage is unavailable during SSR/prerender and the
  // first paint should match the locked markup either way.
  useEffect(() => {
    setUnlocked(isCatalystUnlocked());

    const onUnlock = (e: Event) => {
      setUnlocked(Boolean((e as CustomEvent<boolean>).detail));
    };
    const onStorage = () => setUnlocked(isCatalystUnlocked());

    window.addEventListener(CATALYST_UNLOCK_EVENT, onUnlock);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CATALYST_UNLOCK_EVENT, onUnlock);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [unlocked, useCallback(() => unlockCatalyst(), [])];
}