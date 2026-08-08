import {
  EMPTY_SCENARIO,
  INTERVENTIONS,
  type InterventionKey,
  type Scenario,
} from "@/lib/scenario";
import type { CatalystAction, CatalystIntervention } from "./types";

export const CATALYST_TO_SCENARIO: Record<CatalystIntervention, InterventionKey> = {
  tree_canopy: "street_trees",
  bioswale: "bioswales",
  permeable_pavement: "permeable_pavement",
  green_roof: "green_roofs",
};

export const SCENARIO_TO_CATALYST: Record<InterventionKey, CatalystIntervention> = {
  street_trees: "tree_canopy",
  bioswales: "bioswale",
  permeable_pavement: "permeable_pavement",
  green_roofs: "green_roof",
};

export function scenarioFromCatalystAction(action: CatalystAction): Scenario {
  if (action.type !== "scenario") return EMPTY_SCENARIO;
  return {
    ...EMPTY_SCENARIO,
    [CATALYST_TO_SCENARIO[action.intervention]]: action.fraction,
  };
}

export function catalystLabel(intervention: CatalystIntervention): string {
  const key = CATALYST_TO_SCENARIO[intervention];
  return INTERVENTIONS[key].label;
}
