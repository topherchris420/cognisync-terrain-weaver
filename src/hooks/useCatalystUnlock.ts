import { useCallback, useEffect, useState } from "react";

export const CATALYST_UNLOCK_KEY = "mannahatta:catalyst-unlocked";

function readUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CATALYST_UNLOCK_KEY) === "true";
}

export function useCatalystUnlock() {
  const [isUnlocked, setIsUnlocked] = useState(readUnlocked);

  useEffect(() => {
    setIsUnlocked(readUnlocked());
  }, []);

  const unlock = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CATALYST_UNLOCK_KEY, "true");
    }
    setIsUnlocked(true);
  }, []);

  return { isUnlocked, unlock };
}
