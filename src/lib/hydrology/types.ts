import type { LandCover } from "@/lib/types";
import type {
  FlowPath,
  ImpactPoint,
  RiskZone,
  SimulationResponse,
} from "@/lib/simulation-types";
import type { SurfaceModifierGrid, WaterBalance } from "@/lib/counterfactual/types";

export const LOCAL_HYDROLOGY_MODEL = "mannahatta-d8-local-v1";

export const LOCAL_GRID = {
  low: 36,
  medium: 72,
  high: 120,
} as const;

export type LocalResolution = keyof typeof LOCAL_GRID;

export interface SimExtent {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface HydrographPoint {
  tMin: number;
  qM3s: number;
  rainMm: number;
}

export interface ElevationGrid {
  values: number[][];
  rows: number;
  cols: number;
  status: "observed" | "illustrative";
  hash: string;
  sourceId: string;
  warnings: string[];
}

export interface LocalStormInput {
  bbox: SimExtent;
  rainfallDepthMm: number;
  durationMinutes: number;
  resolution: LocalResolution;
  landCover: LandCover;
  modifiers?: SurfaceModifierGrid;
  surfaceId: "now" | "possible";
  stormHash: string;
  surfaceHash: string;
  expectedElevationHash?: string;
  elevation?: ElevationGrid;
}

export interface LocalStormResult extends SimulationResponse {
  waterBalance: WaterBalance;
  hydrograph: HydrographPoint[];
  peakDischargeM3s: number;
  compositeRunoffC: number;
  elevationHash: string;
  elevationStatus: "observed" | "illustrative";
  modelVersion: string;
  surfaceId: "now" | "possible";
  warnings: string[];
}

export interface StormMetadataExtras {
  runoff_volume_m3: number;
  infiltrated_volume_m3: number;
  rainfall_volume_m3: number;
  stored_volume_m3: number;
  peak_discharge_m3s: number;
  hydrograph: HydrographPoint[];
  elevation_status: "observed" | "illustrative";
  elevation_hash: string;
  model: string;
  surface_id: "now" | "possible";
  land_cover_c: number;
}
