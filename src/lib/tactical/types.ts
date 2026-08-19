/**
 * Tactical Common Operating Picture (COP) Domain Types
 * Designed for Emergency Operations Centers (EOC) and Disaster Response Logistics
 * Running on FedRAMP-compliant GovCloud infrastructure.
 */

export type SensorType = "rain_gauge" | "water_level" | "soil_moisture" | "storm_surge";
export type AlertSeverity = "info" | "advisory" | "watch" | "warning" | "emergency";
export type CorridorStatus = "clear" | "congested" | "flooded" | "closed";
export type SupplyNodeType = "fema_pod" | "logistics_staging" | "emergency_shelter" | "field_hospital";
export type ConvoyStatus = "staged" | "en_route" | "rerouted" | "delivered" | "halted";

export interface IoTSensor {
  id: string;
  name: string;
  type: SensorType;
  coordinates: [number, number]; // [lng, lat]
  reading: number;
  unit: string;
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
  designation: string; // e.g. "Primary Evacuation Route A"
  status: CorridorStatus;
  capacity_pct: number;
  coordinates: [number, number][]; // LineString coords [lng, lat]
  inundation_risk_score: number; // 0 (dry) to 100 (submerged)
  intersecting_flow_volume_m3: number;
  active_hazard_notes?: string;
}

export interface SupplyItem {
  id: string;
  name: string;
  category: "potable_water" | "mre_rations" | "medical" | "power_generators" | "sandbags";
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
  days_of_supply: number; // Days of water/rations remaining
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
  source: "IoT-Telemetry" | "D8-Hydro-Model" | "DOT-Transit" | "EOC-Dispatch";
  coordinates?: [number, number];
  acknowledged: boolean;
}

export interface GovCloudPosture {
  environment: "AWS-GovCloud-US-East" | "AWS-GovCloud-US-West" | "Azure-Government";
  compliance_tier: "FedRAMP High (JAB P-ATO)" | "DoD IL5 (CUI / Mission Critical)";
  fips_140_level: 3;
  encryption_at_rest: "AES-256-GCM (KMS HSM)";
  audit_logging_status: "Active (Zero-Trust Immutable Stream)";
  us_person_sovereignty: true;
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
