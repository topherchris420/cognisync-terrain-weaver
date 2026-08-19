import type { FlowPath, RiskZone } from "@/lib/simulation-types";
import type { TransitCorridor, CorridorStatus } from "./types";

/**
 * Calculates Euclidean distance between two [lng, lat] points in approx meters.
 */
export function geoDistanceMeters(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Point-in-polygon ray-casting test.
 */
export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][]
): boolean {
  if (polygon.length < 3) return false;
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Finds the minimum distance from a point to a segmented line path.
 */
export function minDistanceToPath(
  point: [number, number],
  path: [number, number][]
): number {
  let minD = Infinity;
  for (const p of path) {
    const d = geoDistanceMeters(point, p);
    if (d < minD) minD = d;
  }
  return minD;
}

/**
 * Evaluates transit corridor passability by cross-referencing against D8 runoff flow paths
 * and hydrodynamic flood risk zones.
 */
export function evaluateCorridorHazard(
  corridor: TransitCorridor,
  flowPaths: FlowPath[] = [],
  riskZones: RiskZone[] = []
): {
  status: CorridorStatus;
  inundation_risk_score: number;
  intersecting_flow_volume_m3: number;
  active_hazard_notes: string;
} {
  let totalIntersectingVolume = 0;
  let maxProximityRisk = 0;
  const HAZARD_PROXIMITY_METERS = 35; // 35 meter buffer for flow path breach

  // 1. Check intersection with D8 flow paths
  for (const corridorPt of corridor.coordinates) {
    for (const flow of flowPaths) {
      const dist = minDistanceToPath(corridorPt, flow.points);
      if (dist <= HAZARD_PROXIMITY_METERS) {
        totalIntersectingVolume += flow.volume_m3;
        // Higher volume & closer distance increase risk score
        const proximityWeight = (HAZARD_PROXIMITY_METERS - dist) / HAZARD_PROXIMITY_METERS;
        const volumeWeight = Math.min(flow.volume_m3 / 500, 1.0);
        const score = proximityWeight * volumeWeight * 80;
        if (score > maxProximityRisk) {
          maxProximityRisk = score;
        }
      }
    }

    // 2. Check intersection with severe risk zones
    for (const zone of riskZones) {
      if (pointInPolygon(corridorPt, zone.polygon)) {
        const zoneRiskBonus =
          zone.level === "severe" ? 90 : zone.level === "high" ? 70 : 40;
        if (zoneRiskBonus > maxProximityRisk) {
          maxProximityRisk = zoneRiskBonus;
        }
      }
    }
  }

  const finalScore = Math.min(100, Math.round(maxProximityRisk));

  let status: CorridorStatus = "clear";
  let notes = "Corridor clear of active hydrodynamic inundation.";

  if (finalScore >= 80 || totalIntersectingVolume > 800) {
    status = "closed";
    notes = `IMPASSABLE: Severe runoff convergence detected (${Math.round(totalIntersectingVolume)} m³ flow volume).`;
  } else if (finalScore >= 50 || totalIntersectingVolume > 300) {
    status = "flooded";
    notes = `HAZARDOUS: High water on roadway. Flash flood overflow detected.`;
  } else if (finalScore >= 25 || corridor.capacity_pct > 85) {
    status = "congested";
    notes = `SLOW: Partial pooling or heavy emergency transit volume.`;
  }

  return {
    status,
    inundation_risk_score: finalScore,
    intersecting_flow_volume_m3: Math.round(totalIntersectingVolume),
    active_hazard_notes: notes,
  };
}
