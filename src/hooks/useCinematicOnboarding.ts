import { useState, useEffect, useCallback } from "react";

/**
 * The first fifteen seconds.
 *
 * One sequence, no documentation: fly in, read the ground, storm the city as
 * it stands, redesign it under a budget, run the identical storm again, and
 * show the two realities side by side. Every step is the real engine — the
 * intro simply drives the same controls the user is about to be handed.
 */
export type CinematicState =
  | "IDLE"
  | "FLYING_IN"
  | "READING_GROUND"
  | "STORM_NOW"
  | "REDESIGNING"
  | "STORM_AGAIN"
  | "COMPARING_REALITIES"
  | "FINISHED";

const SEEN_KEY = "mannahatta.intro.seen";

const SUBTITLES: Record<CinematicState, string> = {
  IDLE: "",
  FLYING_IN: "Mannahatta — a spatial counterfactual engine for cities.",
  READING_GROUND: "Reading the ground: pavement, roofs, canopy, soil, water.",
  STORM_NOW: "A 50 mm design storm on the city as it stands.",
  REDESIGNING: "Catalyst redesigns the ground — flood risk down, under $500k.",
  STORM_AGAIN: "The identical storm. Changed ground.",
  COMPARING_REALITIES: "Now — and possible. Drag the divider.",
  FINISHED: "",
};

export function useCinematicOnboarding() {
  const [state, setState] = useState<CinematicState>("IDLE");
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* private mode — play it */
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduced) {
      setState("FINISHED");
      return;
    }
    setIsFirstVisit(true);
    setState("FLYING_IN");
  }, []);

  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const advance = useCallback(
    (next: CinematicState) => {
      setState(next);
      if (next === "FINISHED") markSeen();
    },
    [markSeen]
  );

  const skip = useCallback(() => {
    setState("FINISHED");
    markSeen();
  }, [markSeen]);

  return {
    state,
    isFirstVisit,
    subtitle: SUBTITLES[state],
    advance,
    skip,
    isActive: state !== "IDLE" && state !== "FINISHED",
  };
}
