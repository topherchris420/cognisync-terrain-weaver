import { useState, useCallback } from "react";

export type WorkflowState = 
  | "INTRO"
  | "SEARCH"
  | "ANALYZING"
  | "ANALYZED"
  | "STORM"
  | "STORM_COMPLETE"
  | "REDESIGN"
  | "RERUN_STORM"
  | "COMPARE";

export function useWorkflow() {
  const [state, setState] = useState<WorkflowState>("INTRO");

  const advance = useCallback((newState: WorkflowState) => {
    setState(newState);
  }, []);

  const reset = useCallback(() => {
    setState("SEARCH");
  }, []);

  return {
    state,
    advance,
    reset,
  };
}
