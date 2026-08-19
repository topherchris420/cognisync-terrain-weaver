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

  // 1. Generate USGS Streamgage & Municipal Hydro Sensor Array
  const sensors: IoTSensor[] = [
    {
      id: "sensor-usgs-01",
      name: "USGS Streamgage 01374019 (Catchment Basin Outfall)",
      station_code: "USGS-01374019",
      type: "usgs_streamgage",
      coordinates: offsetCoord(center, -dLng * 0.6, dLat * 0.4),
      reading: 42.5,
      unit: "mm/hr rain",
      stage_height_m: 3.42,
      discharge_m3s: 18.6,
      threshold_warning: 35.0,
      threshold_emergency: 50.0,
      status: "warning",
      battery_pct: 96,
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
      id: "sensor-dep-02",
      name: "City SCADA Culvert Stage Sensor (WL-12)",
      station_code: "NYC-DEP-WL12",
      type: "water_level",
      coordinates: offsetCoord(center, dLng * 0.5, -dLat * 0.5),
      reading: 2.85,
      unit: "m stage",
      stage_height_m: 2.85,
      threshold_warning: 2.2,
      threshold_emergency: 3.0,
      status: "warning",
      battery_pct: 89,
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
      name: "Catchment Soil Moisture Saturation Probe (SM-09)",
      station_code: "USGS-SM09",
      type: "soil_moisture",
      coordinates: offsetCoord(center, -dLng * 0.3, -dLat * 0.6),
      reading: 96.2,
      unit: "% sat",
      threshold_warning: 85.0,
      threshold_emergency: 95.0,
      status: "critical",
      battery_pct: 92,
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
      name: "NOAA Harbor Tidal & Surge Station (NWIS-401)",
      station_code: "NOAA-NWIS401",
      type: "storm_surge",
      coordinates: offsetCoord(center, dLng * 0.8, dLat * 0.7),
      reading: 1.4,
      unit: "m surge",
      stage_height_m: 1.4,
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
      name: "Route 9A Arterial Expressway (Northbound)",
      designation: "Primary Evacuation Route 9A",
      status: "congested",
      capacity_pct: 88,
      inundation_depth_m: 0.12,
      flow_velocity_mps: 0.8,
      coordinates: [
        offsetCoord(center, -dLng * 1.1, -dLat * 0.9),
        offsetCoord(center, -dLng * 0.4, -dLat * 0.2),
        offsetCoord(center, 0, dLat * 0.3),
        offsetCoord(center, dLng * 0.6, dLat * 0.9),
      ],
      inundation_risk_score: 35,
      intersecting_flow_volume_m3: 140,
      active_hazard_notes: "Heavy egress traffic; minor road margin ponding (0.12m depth).",
    },
    {
      id: "corridor-valley-lowland",
      name: "Riverfront Boulevard Lowland Arterial",
      designation: "Secondary Municipal Route L-4",
      status: "flooded",
      capacity_pct: 100,
      inundation_depth_m: 0.45,
      flow_velocity_mps: 2.3,
      coordinates: [
        offsetCoord(center, -dLng * 0.9, -dLat * 0.7),
        offsetCoord(center, -dLng * 0.1, -dLat * 0.6),
        offsetCoord(center, dLng * 0.7, -dLat * 0.4),
        offsetCoord(center, dLng * 1.2, -dLat * 0.2),
      ],
      inundation_risk_score: 78,
      intersecting_flow_volume_m3: 650,
      active_hazard_notes: "ROADWAY CLOSED: 0.45m flash inundation near culvert underpass. Detour to Highland Bypass.",
    },
    {
      id: "corridor-ridge-relief",
      name: "Highland Bypass Viaduct Corridor",
      designation: "Protected Relief Arterial R-9",
      status: "clear",
      capacity_pct: 42,
      inundation_depth_m: 0.0,
      flow_velocity_mps: 0.0,
      coordinates: [
        offsetCoord(center, -dLng * 1.0, dLat * 0.8),
        offsetCoord(center, -dLng * 0.2, dLat * 0.85),
        offsetCoord(center, dLng * 0.5, dLat * 0.75),
        offsetCoord(center, dLng * 1.1, dLat * 0.65),
      ],
      inundation_risk_score: 5,
      intersecting_flow_volume_m3: 0,
      active_hazard_notes: "Elevated structure clear for heavy public works equipment & emergency transit.",
    },
  ];

  // 3. Generate Municipal DPW Staging Yards & Shelter Nodes
  const supply_nodes: SupplyNode[] = [
    {
      id: "node-dpw-yard-a",
      name: "Department of Public Works (DPW) Staging Yard A",
      type: "dpw_staging",
      coordinates: offsetCoord(center, -dLng * 0.9, dLat * 0.7),
      days_of_supply: 8.5,
      inventory: [
        { id: "item-pmp-1", name: "12-Inch Godwin High-Volume Diesel Pumps", category: "pumping_units", quantity: 6, unit: "units" },
        { id: "item-bar-1", name: "Rapid-Deploy Inflatable Flood Barriers (500 LF)", category: "flood_barriers", quantity: 12, unit: "spools" },
        { id: "item-snd-1", name: "Pre-Filled Polypropylene Sandbag Pods", category: "sandbags", quantity: 8500, unit: "bags" },
        { id: "item-gen-1", name: "45kVA Mobile Trailer Generators", category: "power_generators", quantity: 8, unit: "units" },
      ],
      status: "operational",
    },
    {
      id: "node-shelter-civic",
      name: "Civic Center Designated Evacuation Shelter",
      type: "evacuation_shelter",
      coordinates: offsetCoord(center, dLng * 0.4, dLat * 0.1),
      current_occupancy: 420,
      max_capacity: 550,
      days_of_supply: 3.8,
      inventory: [
        { id: "item-w-2", name: "Bulk Potable Water Tanks (500 gal)", category: "potable_water", quantity: 8, unit: "tanks" },
        { id: "item-med-1", name: "Emergency Field Medical & Triage Kits", category: "medical", quantity: 45, unit: "kits" },
      ],
      status: "operational",
    },
    {
      id: "node-pump-station-3",
      name: "District 3 Stormwater Pumping Facility",
      type: "pump_station",
      coordinates: offsetCoord(center, -dLng * 0.2, -dLat * 0.4),
      days_of_supply: 5.0,
      inventory: [
        { id: "item-pmp-2", name: "Submersible De-Watering Pumps", category: "pumping_units", quantity: 10, unit: "units" },
        { id: "item-bar-2", name: "Modular Flood Stop Barriers", category: "flood_barriers", quantity: 80, unit: "panels" },
      ],
      status: "operational",
    },
  ];

  // 4. Generate Active Public Works & Relief Deployments
  const convoys: ConvoyAsset[] = [
    {
      id: "convoy-dpw-14",
      callsign: "DPW Mobile Unit 14 (High-Volume Pumps)",
      origin_id: "node-dpw-yard-a",
      destination_id: "node-pump-station-3",
      coordinates: offsetCoord(center, -dLng * 0.3, dLat * 0.5),
      cargo_description: "2x 12-Inch Godwin Pumps + Discharge Hose Line",
      status: "en_route",
      eta_minutes: 11,
      hazard_reroute_count: 1,
    },
    {
      id: "convoy-bar-08",
      callsign: "Barricade Crew 08 (Flood Barrier Deployment)",
      origin_id: "node-dpw-yard-a",
      destination_id: "node-shelter-civic",
      coordinates: offsetCoord(center, -dLng * 0.6, dLat * 0.1),
      cargo_description: "500 LF Inflatable Water Barrier + Sandbag Pod",
      status: "en_route",
      eta_minutes: 19,
      hazard_reroute_count: 0,
    },
  ];

  // 5. Initial NWS & Municipal EOC Alerts
  const alerts: TacticalAlert[] = [
    {
      id: "alert-001",
      timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      title: "NWS Flash Flood Warning: Lowland Parkway Inundated",
      message: "Stage probe WL-12 triggered flood action threshold (2.85m stage). Water overtopping roadway by 0.45m.",
      severity: "warning",
      source: "NOAA-NWS",
      coordinates: offsetCoord(center, -dLng * 0.1, -dLat * 0.6),
      acknowledged: false,
    },
    {
      id: "alert-002",
      timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
      title: "Hydraulic Surcharge Advisory: District 3 Pumping Station",
      message: "Inflow volume reached 88% rated capacity. Mobile pump unit DPW-14 in transit via Highland Bypass.",
      severity: "advisory",
      source: "City-SCADA",
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
