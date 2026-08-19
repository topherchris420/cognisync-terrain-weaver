/**
 * Tactical Common Operating Picture (COP) Domain Types
 * Designed for Municipal Emergency Operations Centers (EOC),
 * Stormwater Infrastructure Management, and Urban Flood Logistics.
 */

export type SensorType = "usgs_streamgage" | "rain_gauge" | "water_level" | "soil_moisture" | "storm_surge";
export type AlertSeverity = "info" | "advisory" | "watch" | "warning" | "emergency";
export type CorridorStatus = "clear" | "congested" | "flooded" | "closed";
export type SupplyNodeType = "dpw_staging" | "evacuation_shelter" | "pump_station" | "logistics_staging";
export type ConvoyStatus = "staged" | "en_route" | "rerouted" | "delivered" | "halted";

export interface IoTSensor {
  id: string;
  name: string;
  station_code: string; // e.g. "USGS-01374019" or "NYC-DEP-WL4"
  type: SensorType;
  coordinates: [number, number]; // [lng, lat]
  reading: number;
  unit: string;
  stage_height_m?: number;
  discharge_m3s?: number;
  threshold_warning: number;
  threshold_emergency: number;
  status: "normal" | "warning" | "critical" | "offline";
  battery_pct: number;
  last_ping: string;
  historical_readings: { timestamp: string; value: number }[];
}

export interface TransitCorridor {
  id: string;
  name: string;
  designation: string; // e.g. "Primary Evacuation Route 9A"
  status: CorridorStatus;
  capacity_pct: number;
  inundation_depth_m: number;
  flow_velocity_mps: number;
  coordinates: [number, number][]; // LineString coords [lng, lat]
  inundation_risk_score: number; // 0 (dry) to 100 (submerged)
  intersecting_flow_volume_m3: number;
  active_hazard_notes?: string;
}

export interface SupplyItem {
  id: string;
  name: string;
  category: "pumping_units" | "flood_barriers" | "sandbags" | "potable_water" | "power_generators" | "medical";
  quantity: number;
  unit: string;
}

export interface SupplyNode {
  id: string;
  name: string;
  type: SupplyNodeType;
  coordinates: [number, number]; // [lng, lat]
  current_occupancy?: number;
  max_capacity?: number;
  days_of_supply: number;
  inventory: SupplyItem[];
  status: "operational" | "strained" | "evacuating" | "inaccessible";
}

export interface ConvoyAsset {
  id: string;
  callsign: string;
  origin_id: string;
  destination_id: string;
  coordinates: [number, number]; // [lng, lat]
  cargo_description: string;
  status: ConvoyStatus;
  eta_minutes: number;
  hazard_reroute_count: number;
}

export interface TacticalAlert {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  source: "USGS-Streamgage" | "NOAA-NWS" | "City-SCADA" | "EOC-Dispatch";
  coordinates?: [number, number];
  acknowledged: boolean;
}

export interface GovCloudPosture {
  environment: string;
  compliance_tier: string;
  encryption_at_rest: string;
  audit_logging_status: string;
  telemetry_integrity: string;
  last_compliance_sync: string;
}

export interface TacticalCOPState {
  sensors: IoTSensor[];
  corridors: TransitCorridor[];
  supply_nodes: SupplyNode[];
  convoys: ConvoyAsset[];
  alerts: TacticalAlert[];
  govcloud: GovCloudPosture;
  weather_intensity: "normal" | "tropical_storm" | "cloudburst_50mm" | "cat_4_hurricane";
}
