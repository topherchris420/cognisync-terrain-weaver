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
    const hasVisited = localStorage.getItem("mannahatta_visited");
    if (!hasVisited) {
      setIsFirstVisit(true);
      setState("FLYING_IN");
      localStorage.setItem("mannahatta_visited", "true");
    } else {
      setState("FINISHED");
    }
  }, []);

  const advance = useCallback((newState: CinematicState) => {
    setState(newState);
  }, []);

  const skip = useCallback(() => {
    setState("FINISHED");
  }, []);

  // Return the subtitle to display based on the state
  const subtitle = {
    IDLE: "",
    FLYING_IN: "This is Mannahatta. A spatial counterfactual engine.",
    SIMULATING_CURRENT: "Simulating a 50mm design storm on current terrain...",
    REDESIGNING: "Catalyst: Optimizing the ground to reduce risk under $500k...",
    COMPARING_REALITIES: "Comparing realities. The future responds to the ground.",
    FINISHED: ""
  }[state];

  return {
    state,
    isFirstVisit,
    subtitle,
    advance,
    skip,
    isActive: state !== "IDLE" && state !== "FINISHED",
  };
}
