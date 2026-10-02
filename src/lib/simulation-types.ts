export interface SimulationRequest {
  bbox: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  rainfall_mm: number;
  resolution: "low" | "medium" | "high";
  include_drainage: boolean;
}

export interface FlowPath {
  points: [number, number][];
  volume_m3: number;
  velocity_mps: number;
}

export interface RiskZone {
  polygon: [number, number][];
  level: "low" | "moderate" | "high" | "severe";
  affected_area_km2: number;
  /** Standing water depth, meters, from accumulated volume over the cell. */
  flood_depth_m?: number;
}

export interface ImpactPoint {
  location: [number, number];
  accumulated_volume_m3: number;
  flood_depth_m: number;
  risk_level: string;
}

export interface SimulationResponse {
  flow_paths: FlowPath[];
  risk_zones: RiskZone[];
  impact_points: ImpactPoint[];
  metadata: {
    processed_area_km2: number;
    cells_analyzed: number;
    computation_time_ms: number;
    /** Total surface runoff volume for the storm, when the engine reports it. */
    runoff_volume_m3?: number;
    infiltrated_volume_m3?: number;
    rainfall_volume_m3?: number;
    stored_volume_m3?: number;
    /** Runoff held in surface depressions at event end (routing v2+). */
    ponded_volume_m3?: number;
    /** Runoff leaving the extent (routing v2+). */
    outflow_volume_m3?: number;
    peak_discharge_m3s?: number;
    hydrograph?: Array<{ tMin: number; qM3s: number; rainMm: number }>;
    elevation_status?: "observed" | "illustrative";
    elevation_hash?: string;
    model?: string;
    surface_id?: "now" | "possible";
    land_cover_c?: number;
    storm_hash?: string;
    surface_hash?: string;
    /** Identities of every controlled variable (routing v2+); see counterfactual/controlled.ts. */
    rainfall_mm?: number;
    duration_min?: number;
    extent_hash?: string;
    land_cover_hash?: string;
    modifier_hash?: string;
    /** Urban substrate identity the run was made with ("substrate:none" when none was consulted). */
    substrate_hash?: string;
  };
}

export {
  HYDROLOGY_MODEL_VERSION,
  validateSimulationRequest,
  validateSimulationResponse,
} from "../../supabase/functions/_shared/hydrology-contract";

export type {
  HydrologyFlowPath,
  HydrologyImpactPoint,
  HydrologyInput,
  HydrologyModifierCell,
  HydrologyModifierGrid,
  HydrologyProvenance,
  HydrologyRiskZone,
  HydrologyStormDefinition,
  SimBBox,
  SimulationRequestV2,
  SimulationResponseV2,
  SimulationSurfaceInput,
  WaterBalance,
} from "../../supabase/functions/_shared/hydrology-contract";
