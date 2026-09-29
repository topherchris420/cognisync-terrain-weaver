import { ABSORPTION_WEIGHTS } from "@/lib/absorption";
import { INTERVENTIONS, type InterventionKey } from "@/lib/scenario";
import type { InterventionParameters, InterventionType } from "./types";

/**
 * Surface parameters for a drawn intervention. The retention change is the
 * same registered difference the aggregate Scenario Studio uses: converting
 * the intervention's source surface into its target surface.
 */
export function interventionParameters(type: InterventionType): InterventionParameters {
  if (type === "wetland") {
    return { retentionFractionDelta: 0, storageDeltaMm: 0, roughnessDelta: 0, calibrationProvenance: [] };
  }
  const definition = INTERVENTIONS[type as InterventionKey];
  return {
    retentionFractionDelta: Math.min(1, Math.max(0, definition.targetWeight - ABSORPTION_WEIGHTS[definition.source])),
    storageDeltaMm: 0,
    roughnessDelta: 0,
    calibrationProvenance: [],
  };
}
