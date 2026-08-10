import type { AnalysisRecord } from "@/lib/types";
import type { FlowPath, ImpactPoint, RiskZone } from "@/lib/simulation-types";

export type ScientificStatus =
  | "observed"
  | "derived"
  | "modeled"
  | "projected"
  | "speculative";

export interface DataProvenance {
  sourceId: string;
  title: string;
  agency: string;
  url: string;
  observedAt?: string;
  accessedAt: string;
  spatialResolutionM?: number;
  crs?: string;
  license?: string;
  method?: string;
  confidence: "high" | "medium" | "low";
  status: ScientificStatus;
  caveats: string[];
}

export interface StormDefinition {
  id: string;
  rainfallDepthMm: number;
  durationMinutes: number;
  distribution: "uniform";
  resolution: "low" | "medium" | "high";
  includeDrainage: false;
  hash: string;
}

export type InterventionType =
  | "street_trees"
  | "bioswales"
  | "permeable_pavement"
  | "green_roofs"
  | "wetland";

export interface SurfaceModifierCell {
  row: number;
  col: number;
  retentionFractionDelta: number;
  storageDeltaMm: number;
  roughnessDelta: number;
}

export interface SurfaceModifierGrid {
  bbox: { north: number; south: number; east: number; west: number };
  rows: number;
  cols: number;
  cells: SurfaceModifierCell[];
}

export interface EligibilityResult {
  eligible: boolean;
  validGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  invalidGeometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  validAreaM2: number;
  invalidAreaM2: number;
  reasonCodes: Array<
    | "NO_ELIGIBILITY_LAYER"
    | "OUTSIDE_ELIGIBLE_SURFACE"
    | "PARTIALLY_OUTSIDE_ELIGIBLE_SURFACE"
    | "EXCLUDED_GEOMETRY"
  >;
  confidence: "high" | "medium" | "low";
  provenance: DataProvenance[];
  caveats: string[];
}

export interface InterventionParameters {
  retentionFractionDelta: number;
  storageDeltaMm: number;
  roughnessDelta: number;
  calibrationProvenance: DataProvenance[];
}

export interface InterventionFeature {
  id: string;
  type: InterventionType;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  areaM2: number;
  parameters: InterventionParameters;
  eligibility: EligibilityResult;
  provenance: DataProvenance[];
}

export interface RealitySurface {
  id: "now" | "possible";
  baselineLayerHash: string;
  interventionHash: string;
  surfaceHash: string;
  interventions: InterventionFeature[];
  modifiers: SurfaceModifierGrid;
  provenance: DataProvenance[];
  warnings: string[];
}

export interface WaterBalance {
  rainfallM3: number;
  infiltratedM3: number;
  storedM3: number;
  runoffM3: number;
  closureErrorM3: number;
}

export interface RealitySimulation {
  stormHash: string;
  surfaceHash: string;
  modelVersion: string;
  elevationHash: string;
  elevationStatus: "observed" | "illustrative";
  flowPaths: FlowPath[];
  riskZones: RiskZone[];
  impactPoints: ImpactPoint[];
  waterBalance: WaterBalance;
  optimizationClaimsAllowed: boolean;
  warnings: string[];
  provenance: DataProvenance[];
}

export type Epoch = "1609" | "2026" | "future";

export interface MapCameraState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface SpatialContextSnapshot {
  featureCollection: GeoJSON.FeatureCollection;
  coverage: {
    status: "complete" | "partial" | "unavailable";
    requestedAreaM2: number;
    classifiedAreaM2: number;
  };
  provenance: DataProvenance[];
  warnings: string[];
}

export interface OptimizationRequest {
  objective: "minimize-risk" | "maximize-absorption" | "minimize-runoff";
  target?: number;
  maxBudgetUSD?: number;
  allowedInterventions?: InterventionType[];
  excludedGeometry?: GeoJSON.MultiPolygon;
}

export interface OptimizationResult {
  request: OptimizationRequest;
  feasible: boolean;
  status: "feasible" | "closest-feasible" | "unsupported";
  strategy: { features: InterventionFeature[]; costUSD: number };
  constraintGap: number;
  warnings: string[];
  provenance: DataProvenance[];
}

export interface RealityScene {
  surface: RealitySurface;
  simulation: RealitySimulation;
  playbackProgress: number;
  epoch: Epoch;
}

export interface CounterfactualSession {
  phase:
    | "boot"
    | "analyzing"
    | "storm-now"
    | "edit-prompt"
    | "edit"
    | "storm-possible"
    | "compare"
    | "error";
  requestId: string | null;
  analysis: AnalysisRecord | null;
  viewport: MapCameraState;
  spatialContext: SpatialContextSnapshot | null;
  storm: StormDefinition | null;
  epoch: Epoch;
  activeTool: InterventionType | null;
  nowSurface: RealitySurface | null;
  possibleSurface: RealitySurface | null;
  nowSimulation: RealitySimulation | null;
  possibleSimulation: RealitySimulation | null;
  optimization: OptimizationResult | null;
  playback: { playing: boolean; progress: number };
  compareOpen: boolean;
  lastError: string | null;
}
