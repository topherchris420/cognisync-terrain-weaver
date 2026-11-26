import { area, bboxPolygon, difference, feature, featureCollection, intersect } from "@turf/turf";
import { parseBBox } from "@/lib/geo";
import type { SpatialContextResult } from "@/lib/spatial-data/types";
import { evaluateEligibility } from "./eligibility";
import { interventionParameters } from "./intervention-parameters";
import type { InterventionFeature, InterventionType } from "./types";

type SimBBox = { north: number; south: number; east: number; west: number };
type PolygonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

/** A study extent in either the {north, south, east, west} or [[w, s], [e, n]] form. */
export function normalizedBbox(value: unknown): SimBBox | null {
  if (
    value &&
    typeof value === "object" &&
    ["north", "south", "east", "west"].every(
      (key) => typeof (value as Record<string, unknown>)[key] === "number"
    )
  ) {
    return value as SimBBox;
  }
  const parsed = parseBBox(value);
  if (!parsed) return null;
  return {
    west: parsed[0][0],
    south: parsed[0][1],
    east: parsed[1][0],
    north: parsed[1][1],
  };
}

/**
 * The canonical intervention for a polygon, whoever drew it: eligibility,
 * one clipped geometry that drives both costs and grid modifiers, and the
 * registered surface parameters. Hand-drawn shapes and the starting sketch
 * both pass through here, so neither can be modeled differently.
 */
export function interventionFromGeometry(
  geometry: PolygonGeometry,
  type: InterventionType,
  context: SpatialContextResult | null,
  bounds: unknown,
  id: string
): InterventionFeature {
  const eligibility = evaluateEligibility(geometry, type, context);
  const extent = normalizedBbox(bounds);
  if (eligibility.validGeometry) {
    try {
      const clipped = extent ? intersect(featureCollection([
        feature(eligibility.validGeometry),
        bboxPolygon([extent.west, extent.south, extent.east, extent.north]),
      ])) : null;
      const invalid = clipped
        ? difference(featureCollection([feature(geometry), clipped]))
        : feature(geometry);
      eligibility.validGeometry = clipped?.geometry ?? null;
      eligibility.invalidGeometry = invalid?.geometry ?? null;
      eligibility.validAreaM2 = clipped ? area(clipped) : 0;
      eligibility.invalidAreaM2 = invalid ? area(invalid) : 0;
      eligibility.eligible = eligibility.validAreaM2 > 0;
      if (eligibility.invalidAreaM2 > 0.01) {
        eligibility.reasonCodes.push(eligibility.eligible ? "PARTIALLY_OUTSIDE_ELIGIBLE_SURFACE" : "OUTSIDE_ELIGIBLE_SURFACE");
        eligibility.caveats.push("Only geometry inside the analyzed study footprint is modeled.");
      }
    } catch {
      eligibility.eligible = false;
      eligibility.validGeometry = null;
      eligibility.validAreaM2 = 0;
      eligibility.invalidGeometry = geometry;
      eligibility.caveats.push("The drawing could not be clipped to the study footprint.");
    }
  }
  return {
    id,
    type,
    geometry,
    areaM2: eligibility.validAreaM2,
    parameters: interventionParameters(type),
    eligibility,
    provenance: eligibility.provenance,
  };
}
