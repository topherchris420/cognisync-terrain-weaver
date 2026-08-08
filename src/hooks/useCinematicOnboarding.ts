import { useState, useEffect, useCallback } from "react";

export type CinematicState = 
  | "IDLE" 
  | "FLYING_IN" 
  | "SIMULATING_CURRENT" 
  | "REDESIGNING" 
  | "COMPARING_REALITIES" 
  | "FINISHED";

export function useCinematicOnboarding() {
  const [state, setState] = useState<CinematicState>("IDLE");
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    setIsFirstVisit(true);
    setState("FLYING_IN");
  }, []);

  const advance = useCallback((newState: CinematicState) => {
    setState(newState);
  }, []);

  const skip = useCallback(() => {
    setState("FINISHED");
  }, []);

  return {
    state,
    isFirstVisit,
    advance,
    skip,
    isActive: state !== "IDLE" && state !== "FINISHED",
  };
}
