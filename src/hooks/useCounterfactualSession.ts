import { useMemo, useReducer } from "react";
import {
  counterfactualReducer,
  createCounterfactualSession,
  selectCanCompare,
  selectProjectedStatus,
} from "@/lib/counterfactual/session";

export function useCounterfactualSession() {
  const [state, dispatch] = useReducer(
    counterfactualReducer,
    undefined,
    createCounterfactualSession
  );

  const canCompare = useMemo(() => selectCanCompare(state), [state]);
  const projectedStatus = useMemo(() => selectProjectedStatus(state), [state]);

  return {
    state,
    dispatch,
    canCompare,
    projectedStatus,
  };
}
