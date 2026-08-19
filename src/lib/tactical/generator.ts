import type {
  IoTSensor,
  TransitCorridor,
  SupplyNode,
  ConvoyAsset,
  TacticalAlert,
  TacticalCOPState,
} from "./types";
import { DEFAULT_GOVCLOUD_POSTURE } from "./compliance";

interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Deterministic pseudo-random offset within a bounding box.
 */
function offsetCoord(center: [number, number], dxDeg: number, dyDeg: number): [number, number] {
  return [
    Number((center[0] + dxDeg).toFixed(6)),
    Number((center[1] + dyDeg).toFixed(6)),
  ];
}

/**
 * Generates initial tactical assets georeferenced around the current map viewport.
 */
export function generateTacticalAssets(
  centerLat: number,
  centerLng: number,
  bbox?: BBox | null
): TacticalCOPState {
  const center: [number, number] = [centerLng, centerLat];
  
  // Span dimensions
  const dLat = bbox ? (bbox.north - bbox.south) * 0.4 : 0.008;
  const dLng = bbox ? (bbox.east - bbox.west) * 0.4 : 0.01;

  // 1. Generate IoT Telemetry Sensor Array
  const sensors: IoTSensor[] = [
    {
      id: "sensor-rg-01",
      name: "Rain Gauge Alpha (Downtown Drainage Basin)",
      type: "rain_gauge",
      coordinates: offsetCoord(center, -dLng * 0.6, dLat * 0.4),
      reading: 42.5,
      unit: "mm/hr",
      threshold_warning: 35.0,
      threshold_emergency: 50.0,
      status: "warning",
      battery_pct: 94,
      last_ping: new Date().toISOString(),
      historical_readings: [
        { timestamp: "T-20m", value: 12.0 },
        { timestamp: "T-15m", value: 24.5 },
        { timestamp: "T-10m", value: 34.0 },
        { timestamp: "T-5m", value: 39.8 },
        { timestamp: "Now", value: 42.5 },
      ],
    },
    {
      id: "sensor-wl-02",
      name: "Culvert Water Level Probe WL-4",
      type: "water_level",
      coordinates: offsetCoord(center, dLng * 0.5, -dLat * 0.5),
      reading: 2.85,
      unit: "m stage",
      threshold_warning: 2.2,
      threshold_emergency: 3.0,
      status: "warning",
      battery_pct: 88,
      last_ping: new Date().toISOString(),
      historical_readings: [
        { timestamp: "T-20m", value: 1.1 },
        { timestamp: "T-15m", value: 1.6 },
        { timestamp: "T-10m", value: 2.1 },
        { timestamp: "T-5m", value: 2.6 },
        { timestamp: "Now", value: 2.85 },
      ],
    },
    {
      id: "sensor-sm-03",
      name: "Soil Moisture Saturation Sensor SM-09",
      type: "soil_moisture",
      coordinates: offsetCoord(center, -dLng * 0.3, -dLat * 0.6),
      reading: 96.2,
      unit: "% sat",
      threshold_warning: 85.0,
      threshold_emergency: 95.0,
      status: "critical",
      battery_pct: 91,
      last_ping: new Date().toISOString(),
      historical_readings: [
        { timestamp: "T-20m", value: 72.0 },
        { timestamp: "T-15m", value: 81.0 },
        { timestamp: "T-10m", value: 89.5 },
        { timestamp: "T-5m", value: 94.0 },
        { timestamp: "Now", value: 96.2 },
      ],
    },
    {
      id: "sensor-surge-04",
      name: "Coastal Outfall / Storm Surge Sensor SS-1",
      type: "storm_surge",
      coordinates: offsetCoord(center, dLng * 0.8, dLat * 0.7),
      reading: 1.4,
      unit: "m surge",
      threshold_warning: 1.2,
      threshold_emergency: 2.0,
      status: "warning",
      battery_pct: 99,
      last_ping: new Date().toISOString(),
      historical_readings: [
        { timestamp: "T-20m", value: 0.3 },
        { timestamp: "T-15m", value: 0.7 },
        { timestamp: "T-10m", value: 1.0 },
        { timestamp: "T-5m", value: 1.25 },
        { timestamp: "Now", value: 1.4 },
      ],
    },
  ];

  // 2. Generate Transit & Evacuation Corridors
  const corridors: TransitCorridor[] = [
    {
      id: "corridor-evac-north",
      name: "Arterial Expressway (Northbound)",
      designation: "Primary Evac Corridor A-1",
      status: "congested",
      capacity_pct: 88,
      coordinates: [
        offsetCoord(center, -dLng * 1.1, -dLat * 0.9),
        offsetCoord(center, -dLng * 0.4, -dLat * 0.2),
        offsetCoord(center, 0, dLat * 0.3),
        offsetCoord(center, dLng * 0.6, dLat * 0.9),
      ],
      inundation_risk_score: 35,
      intersecting_flow_volume_m3: 140,
      active_hazard_notes: "Heavy evacuation egress traffic; minor road margin ponding.",
    },
    {
      id: "corridor-valley-lowland",
      name: "Riverfront Boulevard / Lowland Parkway",
      designation: "Secondary Logistics Route L-4",
      status: "flooded",
      capacity_pct: 100,
      coordinates: [
        offsetCoord(center, -dLng * 0.9, -dLat * 0.7),
        offsetCoord(center, -dLng * 0.1, -dLat * 0.6),
        offsetCoord(center, dLng * 0.7, -dLat * 0.4),
        offsetCoord(center, dLng * 1.2, -dLat * 0.2),
      ],
      inundation_risk_score: 78,
      intersecting_flow_volume_m3: 650,
      active_hazard_notes: "ROADWAY FLOODED: 0.4m standing water reported near underpass.",
    },
    {
      id: "corridor-ridge-relief",
      name: "Highland Bypass Viaduct",
      designation: "Protected Relief Corridor R-9",
      status: "clear",
      capacity_pct: 42,
      coordinates: [
        offsetCoord(center, -dLng * 1.0, dLat * 0.8),
        offsetCoord(center, -dLng * 0.2, dLat * 0.85),
        offsetCoord(center, dLng * 0.5, dLat * 0.75),
        offsetCoord(center, dLng * 1.1, dLat * 0.65),
      ],
      inundation_risk_score: 5,
      intersecting_flow_volume_m3: 0,
      active_hazard_notes: "Optimal elevated route for high-capacity supply convoys.",
    },
  ];

  // 3. Generate Relief Supply Chain & Shelter Nodes
  const supply_nodes: SupplyNode[] = [
    {
      id: "node-fema-pod-1",
      name: "FEMA Staging Area Alpha (Regional Airport)",
      type: "logistics_staging",
      coordinates: offsetCoord(center, -dLng * 0.9, dLat * 0.7),
      days_of_supply: 8.5,
      inventory: [
        { id: "item-w-1", name: "Palletized Bottled Water", category: "potable_water", quantity: 18500, unit: "liters" },
        { id: "item-mre-1", name: "FEMA Standard MRE Rations", category: "mre_rations", quantity: 12000, unit: "meals" },
        { id: "item-gen-1", name: "25kVA Diesel Generators", category: "power_generators", quantity: 14, unit: "units" },
        { id: "item-sand-1", name: "Polypropylene Sandbags", category: "sandbags", quantity: 8500, unit: "bags" },
      ],
      status: "operational",
    },
    {
      id: "node-shelter-metro",
      name: "Metro High School Emergency Shelter",
      type: "emergency_shelter",
      coordinates: offsetCoord(center, dLng * 0.4, dLat * 0.1),
      current_occupancy: 420,
      max_capacity: 500,
      days_of_supply: 1.8,
      inventory: [
        { id: "item-w-2", name: "Potable Water Containers", category: "potable_water", quantity: 2100, unit: "liters" },
        { id: "item-mre-2", name: "Ready-to-Eat Meal Kits", category: "mre_rations", quantity: 850, unit: "meals" },
        { id: "item-med-1", name: "Trauma / First Aid Kits", category: "medical", quantity: 45, unit: "kits" },
      ],
      status: "strained",
    },
    {
      id: "node-field-clinic",
      name: "Mobile Medical Tent Clinic #3",
      type: "field_hospital",
      coordinates: offsetCoord(center, -dLng * 0.2, -dLat * 0.4),
      current_occupancy: 38,
      max_capacity: 50,
      days_of_supply: 3.2,
      inventory: [
        { id: "item-med-2", name: "Emergency Trauma Supplies", category: "medical", quantity: 120, unit: "kits" },
        { id: "item-w-3", name: "Sterile Saline / Potable Water", category: "potable_water", quantity: 900, unit: "liters" },
      ],
      status: "operational",
    },
  ];

  // 4. Generate Active Supply Convoys
  const convoys: ConvoyAsset[] = [
    {
      id: "convoy-echo-4",
      callsign: "Convoy ECHO-4 (Potable Water Resupply)",
      origin_id: "node-fema-pod-1",
      destination_id: "node-shelter-metro",
      coordinates: offsetCoord(center, -dLng * 0.3, dLat * 0.5),
      cargo_description: "6,000L Potable Water + 1,500 MREs",
      status: "en_route",
      eta_minutes: 14,
      hazard_reroute_count: 1,
    },
    {
      id: "convoy-bravo-2",
      callsign: "Convoy BRAVO-2 (Generator Staging)",
      origin_id: "node-fema-pod-1",
      destination_id: "node-field-clinic",
      coordinates: offsetCoord(center, -dLng * 0.6, dLat * 0.1),
      cargo_description: "4x 25kVA Generators + Fuel Pod",
      status: "en_route",
      eta_minutes: 22,
      hazard_reroute_count: 0,
    },
  ];

  // 5. Initial Tactical Alerts
  const alerts: TacticalAlert[] = [
    {
      id: "alert-001",
      timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      title: "Flash Flood Warning: Lowland Parkway Inundated",
      message: "Sensor WL-4 triggered emergency threshold (2.85m stage). Water overtopping roadway by 0.4m.",
      severity: "warning",
      source: "IoT-Telemetry",
      coordinates: offsetCoord(center, -dLng * 0.1, -dLat * 0.6),
      acknowledged: false,
    },
    {
      id: "alert-002",
      timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
      title: "Shelter Supply Strain: Metro High School",
      message: "Water & food reserves under 48 hours DOS. Convoy ECHO-4 dispatched via Highland Bypass.",
      severity: "advisory",
      source: "EOC-Dispatch",
      coordinates: offsetCoord(center, dLng * 0.4, dLat * 0.1),
      acknowledged: true,
    },
  ];

  return {
    sensors,
    corridors,
    supply_nodes,
    convoys,
    alerts,
    govcloud: DEFAULT_GOVCLOUD_POSTURE,
    weather_intensity: "cloudburst_50mm",
  };
}
