import type { ScenarioImpact } from "@/lib/scenario";

export type ProvenanceKind =
  | "measured"
  | "derived"
  | "simulated"
  | "estimated"
  | "reconstructed"
  | "inferred"
  | "unavailable";

export type ScientificStatus = "established" | "experimental" | "speculative";

export type CatalystTemporalMode = "historical" | "present" | "future";

export type CatalystIntervention =
  | "tree_canopy"
  | "bioswale"
  | "permeable_pavement"
  | "green_roof";

export type GeoJsonGeometry =
  | {
      type: "Point";
      coordinates: [number, number];
    }
  | {
      type: "Polygon";
      coordinates: Array<Array<[number, number]>>;
    }
  | {
      type: "MultiPolygon";
      coordinates: Array<Array<Array<[number, number]>>>;
    }
  | {
      type: "LineString";
      coordinates: Array<[number, number]>;
    };

export interface CatalystSiteContext {
  analysisId?: string;
  location?: {
    name?: string;
    latitude: number;
    longitude: number;
    zoom?: number;
    bbox?: [number, number, number, number];
  };
  present: {
    absorptionScore: number;
    landCover: {
      vegetation: number;
      bareSoil: number;
      buildings: number;
      pavement: number;
      water?: number;
    };
    floodRisk?: string;
  };
  historical1609: {
    absorptionScore: number;
    deltaFromPresent: number;
    provenance: ProvenanceKind;
  };
  activeScenario?: {
    intervention?: string;
    fraction?: number;
    projectedScore?: number;
    addedRetentionM3?: number;
    cost?: number;
  };
  rainfall?: {
    depthMm?: number;
  };
  hydrology?: {
    estimatedRunoffM3?: number;
    riskSummary?: string;
  };
}

export type CatalystAction =
  | {
      type: "scenario";
      intervention: CatalystIntervention;
      fraction: number;
      geometry?: GeoJsonGeometry;
    }
  | {
      type: "hydrology";
      rainfallMm: number;
      resolution?: "low" | "medium" | "high";
    }
  | {
      type: "comparison";
      variants: ScenarioVariant[];
    }
  | {
      type: "custom";
      executable: false;
      description: string;
    };

export interface ScenarioVariant {
  id: string;
  label: string;
  intervention: CatalystIntervention;
  fraction: number;
  projectedScore?: number;
  addedRetentionM3?: number;
  cost?: number;
}

export interface CatalystClaim {
  id: string;
  statement: string;
  status: ScientificStatus;
  evidenceNeeded?: string[];
}

export interface CatalystVariable {
  name: string;
  role: "independent" | "dependent" | "control";
  unit?: string;
}

export interface CatalystExperiment {
  id: string;
  hypothesis: string;
  objective: string;
  scientificStatus: ScientificStatus;
  assumptions: string[];
  claims: CatalystClaim[];
  variables: CatalystVariable[];
  methodology: string[];
  successCriteria: string[];
  falsificationCriteria: string[];
  limitations: string[];
  requiredData: string[];
  actions: CatalystAction[];
  executionStatus:
    | "draft"
    | "partially-executable"
    | "executable"
    | "running"
    | "completed";
  verification?: {
    score?: number;
    warnings: string[];
  };
}

export interface CatalystSimulationResult {
  experimentId: string;
  outcome:
    | "SUPPORTED UNDER THIS SIMULATION"
    | "NOT SUPPORTED UNDER THIS SIMULATION"
    | "FALSIFIED UNDER TESTED CONDITIONS"
    | "INCONCLUSIVE";
  scenarioImpact?: ScenarioImpact;
  warnings: string[];
}

export type CatalystRequest =
  | {
      kind: "minimum-intervention";
      targetScore: number;
      intervention: CatalystIntervention;
    }
  | {
      kind: "compare-interventions";
      fraction: number;
    }
  | {
      kind: "storm-stress-test";
      rainfallMm: number;
    }
  | {
      kind: "restore-lost-system";
      fraction: number;
    }
  | {
      kind: "custom";
      text: string;
    };

export interface CatalystProvider {
  compileExperiment(
    context: CatalystSiteContext,
    request: CatalystRequest
  ): Promise<CatalystExperiment>;
  evaluateExperiment?(
    experiment: CatalystExperiment,
    result: CatalystSimulationResult
  ): Promise<CatalystSimulationResult>;
}

export interface CatalystFieldNote {
  id: string;
  timestamp: string;
  hypothesis: string;
  terrainContext: {
    presentScore: number;
    historicalScore: number;
    provenance: ProvenanceKind;
  };
  intervention: string;
  outcome: CatalystSimulationResult["outcome"];
  assumptions: string[];
  limitations: string[];
}
