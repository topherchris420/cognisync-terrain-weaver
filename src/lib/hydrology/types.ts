import type { LandCover } from "@/lib/types";
import type {
  FlowPath,
  ImpactPoint,
  RiskZone,
  SimulationResponse,
} from "@/lib/simulation-types";
import type { SurfaceModifierGrid, WaterBalance } from "@/lib/counterfactual/types";

/**
 * v2 (2026-09-29): depression filling before D8 (routing/R1, R2; see
 * experiments/REVISIONS.md). v1 results must never pair with v2 results.
 */
export const LOCAL_HYDROLOGY_MODEL = "mannahatta-d8-local-v2";

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
  /**
   * Identity of the urban substrate the study loaded (urban-substrate/identity).
   * Recorded as a controlled variable; the D8 routing itself reads no
   * substrate geometry. Omitted means no substrate was consulted.
   */
  substrateHash?: string;
  /**
   * Real recorded hourly rainfall for an observed storm (minutes from event
   * start). When present it drives the hydrograph shape instead of the
   * synthetic triangular distribution.
   */
  hyetograph?: Array<{ tMin: number; rainMm: number }>;
  /**
   * Real drainage inventory rasterised onto the sim grid (catch basins).
   * Per-cell capacity is subtracted from generated runoff before routing.
   */
  drainage?: {
    status: "observed" | "unavailable";
    basins: number;
    capacityM3: number[][];
    sourceLabel: string;
  };
}

/**
 * Per-cell water for one routed run, in cubic metres. Kept in memory so a
 * controlled NOW / POSSIBLE pair can be compared cell by cell (where the
 * redesign changed what passes through the ground). Never exported: a replay
 * recomputes it from the inputs, so a file cannot assert a map it did not earn.
 */
export interface StormCellGrid {
  rows: number;
  cols: number;
  cellAreaM2: number;
  /** Runoff generated on each cell before routing. Differs between NOW and POSSIBLE only where the drawn surface changed. */
  generatedM3: number[][];
  /** Water passing through each cell after fill-and-spill routing, upstream contributions included. */
  accumulationM3: number[][];
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
  cells: StormCellGrid;
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
