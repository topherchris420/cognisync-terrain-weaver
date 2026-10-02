import { lineLengthM, lineToStored, offsetRibbon, positionsToLocal, ringToStored, signedArea, simplifyLine } from "../geometry";
import { FEET_TO_METRES, quantizeLonLat, roundTo } from "../projection";
import type { RawStreet } from "../sources";
import type { AttributeSpec, ContextStreetFeature, Position, RoadClass, StreetSegmentFeature, TrafficDirection } from "../types";
import { byId, countIssues, inCanonicalOrder, integerId, positiveOrNull, textOrNull } from "./common";

export const STREETS_SOURCE = "nyc-street-centerline";

/** CSCL RW_TYPE (Street Centerline data dictionary). */
export const ROAD_CLASSES: Record<string, RoadClass> = {
  "1": "street",
  "2": "highway",
  "3": "bridge",
  "4": "tunnel",
  "5": "boardwalk",
  "6": "path",
  "7": "step-street",
  "8": "driveway",
  "9": "ramp",
  "10": "alley",
  "11": "unknown",
  "12": "non-physical",
  "13": "u-turn",
  "14": "ferry-route",
};

/** CSCL TRAFDIR, relative to the segment's address range. */
export const TRAFFIC_DIRECTIONS: Record<string, TrafficDirection> = {
  FT: "with-address-range",
  TF: "against-address-range",
  TW: "two-way",
  NV: "non-vehicular",
};

/** CSCL STATUS 2 = constructed; paper, planned and demapped streets are not on the ground. */
const CONSTRUCTED = "2";
const NOT_ON_THE_GROUND: ReadonlySet<RoadClass> = new Set(["non-physical", "ferry-route"]);
/** Road classes the pedestrian graph never uses, whatever other fields say. */
const PEDESTRIAN_PROHIBITED: ReadonlySet<RoadClass> = new Set(["highway", "ramp", "tunnel"]);
export const AT_GRADE_LEVEL = "13";

export const STREET_ATTRIBUTES: AttributeSpec[] = [
  { name: "geometry", unit: null, evidence: "measured", source: STREETS_SOURCE, field: "the_geom", transform: "contiguous MultiLineString parts joined, rounded to 1e-7°, consecutive duplicates removed" },
  { name: "lengthM", unit: "m", evidence: "modeled", source: "derived", field: null, transform: "planar length in the substrate grid (SHAPE__Length is marked 'do not use' by the provider)" },
  { name: "roadClass", unit: null, evidence: "measured", source: STREETS_SOURCE, field: "rw_type", transform: "code mapped to the data dictionary label" },
  { name: "widthM", unit: "m", evidence: "measured", source: STREETS_SOURCE, field: "streetwidth", transform: "paved width in feet × 0.3048; null where 0 or absent" },
  { name: "trafficDirection", unit: null, evidence: "measured", source: STREETS_SOURCE, field: "trafdir", transform: "FT/TF/TW/NV mapped; relative to the address range, which the street graph assumes runs from the first to the last vertex (CSCL convention, not verified per segment)" },
  { name: "travelLanes", unit: "lanes", evidence: "measured", source: STREETS_SOURCE, field: "number_travel_lanes", transform: "integer; null where absent" },
  { name: "levelCodes", unit: null, evidence: "measured", source: STREETS_SOURCE, field: "from_level_code, to_level_code", transform: "raw codes; 13 = at grade, others grade-separated" },
  { name: "pedestrianExcluded", unit: null, evidence: "modeled", source: "derived", field: "nonped, rw_type, status", transform: "true for non-physical segments, highways, ramps, tunnels, and any non-empty nonped (undocumented; treated conservatively)" },
  { name: "surface", unit: null, evidence: "modeled", source: "derived", field: null, transform: "centreline offset by half the recorded width; null where the width is unknown; not the planimetric roadbed" },
  { name: "surfaceAreaM2", unit: "m²", evidence: "modeled", source: "derived", field: null, transform: "planar area of the modelled surface" },
];

export interface StreetStats {
  input: number;
  kept: number;
  dropped: Record<string, number>;
  missing: Record<string, number>;
  issues: Record<string, number>;
}

function isPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}

/** Join contiguous parts into one line; flag and keep only the first chain if parts are disjoint. */
function joinParts(geometry: RawStreet["the_geom"]): { line: Position[] | null; issues: string[] } {
  if (!geometry) return { line: null, issues: ["missing-geometry"] };
  const parts =
    geometry.type === "LineString" ? [geometry.coordinates] : geometry.type === "MultiLineString" ? (geometry.coordinates as unknown[]) : null;
  if (!parts) return { line: null, issues: ["unsupported-geometry"] };
  const issues: string[] = [];
  const line: Position[] = [];
  for (const part of parts) {
    if (!Array.isArray(part) || !part.every(isPosition)) return { line: null, issues: ["non-finite-coordinate"] };
    const points = part as Position[];
    if (line.length && (line[line.length - 1][0] !== points[0][0] || line[line.length - 1][1] !== points[0][1])) {
      issues.push("non-contiguous-parts");
      break;
    }
    for (const p of line.length ? points.slice(1) : points) line.push([p[0], p[1]]);
  }
  return { line, issues };
}

export function normalizeStreets(rows: RawStreet[]): { features: Omit<StreetSegmentFeature, "nodes">[]; stats: StreetStats } {
  const stats: StreetStats = { input: rows.length, kept: 0, dropped: {}, missing: { widthM: 0, trafficDirection: 0, travelLanes: 0, name: 0 }, issues: {} };
  const seen = new Set<string>();
  const features: Omit<StreetSegmentFeature, "nodes">[] = [];
  for (const row of inCanonicalOrder(rows)) {
    const globalId = textOrNull(row.globalid);
    const id = globalId ? `street:${globalId.toLowerCase()}` : null;
    if (!id || seen.has(id)) {
      stats.dropped[id ? "duplicate-id" : "no-identifier"] = (stats.dropped[id ? "duplicate-id" : "no-identifier"] ?? 0) + 1;
      continue;
    }
    const { line: raw, issues } = joinParts(row.the_geom);
    const stored: Position[] = [];
    for (const p of raw ?? []) {
      const q = quantizeLonLat(p);
      const last = stored[stored.length - 1];
      if (!last || last[0] !== q[0] || last[1] !== q[1]) stored.push(q);
    }
    if (stored.length < 2) {
      stats.dropped["unusable-geometry"] = (stats.dropped["unusable-geometry"] ?? 0) + 1;
      countIssues(stats.issues, issues.length ? issues : ["degenerate-line"]);
      continue;
    }
    seen.add(id);
    countIssues(stats.issues, issues);
    const local = positionsToLocal(stored);
    const roadwayTypeCode = integerId(row.rw_type);
    const roadClass = (roadwayTypeCode && ROAD_CLASSES[roadwayTypeCode]) || "unknown";
    const constructionStatus = textOrNull(row.status);
    const physical = constructionStatus === CONSTRUCTED && !NOT_ON_THE_GROUND.has(roadClass);
    const widthFt = positiveOrNull(row.streetwidth);
    const widthM = widthFt === null ? null : roundTo(widthFt * FEET_TO_METRES, 2);
    const ribbon = physical && widthM !== null ? offsetRibbon(local, widthM / 2) : null;
    const surface = ribbon ? ringToStored(ribbon) : null;
    const trafficCode = textOrNull(row.trafdir);
    const lanes = integerId(row.number_travel_lanes);
    const parking = integerId(row.number_park_lanes);
    const feature: Omit<StreetSegmentFeature, "nodes"> = {
      id,
      sourceId: STREETS_SOURCE,
      physicalId: integerId(row.physicalid),
      name: textOrNull(row.full_street_name),
      geometry: { type: "LineString", coordinates: stored },
      lengthM: roundTo(lineLengthM(local), 2),
      roadwayTypeCode,
      roadClass,
      physical,
      constructionStatus,
      widthM,
      trafficDirection: trafficCode ? TRAFFIC_DIRECTIONS[trafficCode] ?? null : null,
      travelLanes: lanes === null ? null : Number(lanes),
      parkingLanes: parking === null ? null : Number(parking),
      levelCodes: [integerId(row.from_level_code), integerId(row.to_level_code)],
      pedestrianExcluded: !physical || PEDESTRIAN_PROHIBITED.has(roadClass) || textOrNull(row.nonped) !== null,
      surface: surface && surface.length >= 4 ? { type: "Polygon", coordinates: [surface] } : null,
      surfaceAreaM2: surface && surface.length >= 4 ? roundTo(Math.abs(signedArea(positionsToLocal(surface))), 2) : null,
      geometryIssues: issues,
    };
    if (feature.widthM === null) stats.missing.widthM += 1;
    if (feature.trafficDirection === null) stats.missing.trafficDirection += 1;
    if (feature.travelLanes === null) stats.missing.travelLanes += 1;
    if (feature.name === null) stats.missing.name += 1;
    features.push(feature);
  }
  features.sort(byId);
  stats.kept = features.length;
  return { features, stats };
}

export function pedestrianExclusionReason(segment: Pick<StreetSegmentFeature, "physical" | "roadClass" | "pedestrianExcluded">): string | null {
  if (!segment.pedestrianExcluded) return null;
  if (!segment.physical) return "not-physical";
  if (PEDESTRIAN_PROHIBITED.has(segment.roadClass)) return `road-class:${segment.roadClass}`;
  return "nonped-flag";
}

export function contextStreet(segment: StreetSegmentFeature, toleranceM: number): ContextStreetFeature {
  const simplified = lineToStored(simplifyLine(positionsToLocal(segment.geometry.coordinates as Position[]), toleranceM));
  return {
    id: segment.id,
    geometry: { type: "LineString", coordinates: simplified.length >= 2 ? simplified : (segment.geometry.coordinates as Position[]) },
    roadClass: segment.roadClass,
    widthM: segment.widthM,
  };
}
