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
  };
}