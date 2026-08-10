import {
  area,
  difference,
  feature,
  featureCollection,
  intersect,
  union,
} from "@turf/turf";
import type { SpatialContextResult } from "@/lib/spatial-data/types";
import type {
  DataProvenance,
  EligibilityResult,
  InterventionType,
} from "./types";

type PolygonGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

const WETLAND_DISABLED =
  "No defensible wetland suitability layer is loaded for this place.";
const FEASIBILITY_CAVEAT =
  "Right-of-way, utilities, ownership, and constructability are not modeled.";

function asFeature(geometry: PolygonGeometry) {
  return feature(geometry);
}

function polygonFeatures(
  context: SpatialContextResult | null,
  surfaceClass: "buildings" | "pavement"
): GeoJSON.Feature<PolygonGeometry>[] {
  if (!context) return [];
  return context.featureCollection.features.filter(
    (candidate): candidate is GeoJSON.Feature<PolygonGeometry> =>
      candidate.properties.surfaceClass === surfaceClass &&
      (candidate.geometry.type === "Polygon" ||
        candidate.geometry.type === "MultiPolygon")
  );
}

function mergePolygons(
  features: GeoJSON.Feature<PolygonGeometry>[]
): GeoJSON.Feature<PolygonGeometry> | null {
  if (features.length === 0) return null;
  if (features.length === 1) return features[0];
  return union(featureCollection(features));
}

function intersectionOf(
  left: PolygonGeometry,
  right: GeoJSON.Feature<PolygonGeometry>
): PolygonGeometry | null {
  return intersect(featureCollection([asFeature(left), right]))?.geometry ?? null;
}

function differenceOf(
  left: PolygonGeometry,
  right: PolygonGeometry | null
): PolygonGeometry | null {
  if (!right) return left;
  return (
    difference(featureCollection([asFeature(left), asFeature(right)]))
      ?.geometry ?? null
  );
}

function provenanceFor(
  context: SpatialContextResult | null,
  sourceIds: Set<string>
): DataProvenance[] {
  if (!context) return [];
  return context.provenance.filter((item) => sourceIds.has(item.sourceId));
}

function resultFrom(
  validGeometry: PolygonGeometry | null,
  invalidGeometry: PolygonGeometry | null,
  reasonCodes: EligibilityResult["reasonCodes"],
  confidence: EligibilityResult["confidence"],
  provenance: DataProvenance[],
  caveats: string[]
): EligibilityResult {
  const validAreaM2 = validGeometry ? area(validGeometry) : 0;
  const invalidAreaM2 = invalidGeometry ? area(invalidGeometry) : 0;
  return {
    eligible: validGeometry !== null && validAreaM2 > 0,
    validGeometry,
    invalidGeometry,
    validAreaM2,
    invalidAreaM2,
    reasonCodes,
    confidence,
    provenance,
    caveats,
  };
}

export function evaluateEligibility(
  draft: PolygonGeometry,
  type: InterventionType,
  context: SpatialContextResult | null
): EligibilityResult {
  if (type === "wetland") {
    return resultFrom(
      null,
      draft,
      ["NO_ELIGIBILITY_LAYER"],
      "low",
      [],
      [WETLAND_DISABLED]
    );
  }

  if (type === "green_roofs" || type === "permeable_pavement") {
    const requiredClass =
      type === "green_roofs" ? "buildings" : "pavement";
    const candidates = polygonFeatures(context, requiredClass);
    const sourceIds = new Set(
      candidates.map((candidate) => candidate.properties.sourceId)
    );
    const merged = mergePolygons(candidates);
    if (!merged) {
      return resultFrom(
        null,
        draft,
        ["NO_ELIGIBILITY_LAYER"],
        "low",
        [],
        [
          `No observed ${requiredClass} eligibility geometry is loaded for this place.`,
        ]
      );
    }

    try {
      const valid = intersectionOf(draft, merged);
      const invalid = differenceOf(draft, valid);
      const invalidAreaM2 = invalid ? area(invalid) : 0;
      const reasonCodes: EligibilityResult["reasonCodes"] = [];
      if (!valid) {
        reasonCodes.push("OUTSIDE_ELIGIBLE_SURFACE");
      } else if (invalidAreaM2 > 0.01) {
        reasonCodes.push("PARTIALLY_OUTSIDE_ELIGIBLE_SURFACE");
      }
      return resultFrom(
        valid,
        invalid,
        reasonCodes,
        "high",
        provenanceFor(context, sourceIds),
        context?.coverage.status === "partial"
          ? ["Official eligibility coverage is partial for this place."]
          : []
      );
    } catch {
      return resultFrom(
        null,
        draft,
        ["NO_ELIGIBILITY_LAYER"],
        "low",
        provenanceFor(context, sourceIds),
        ["Eligibility geometry could not be resolved without overclaiming."]
      );
    }
  }

  const buildings = polygonFeatures(context, "buildings");
  const sourceIds = new Set(
    buildings.map((candidate) => candidate.properties.sourceId)
  );
  const mergedBuildings = mergePolygons(buildings);
  try {
    const invalid = mergedBuildings
      ? intersectionOf(draft, mergedBuildings)
      : null;
    const valid = differenceOf(draft, invalid);
    const reasonCodes: EligibilityResult["reasonCodes"] = [];
    if (!context) reasonCodes.push("NO_ELIGIBILITY_LAYER");
    if (invalid && area(invalid) > 0.01) {
      reasonCodes.push("EXCLUDED_GEOMETRY");
    }
    return resultFrom(
      valid,
      invalid,
      reasonCodes,
      "medium",
      provenanceFor(context, sourceIds),
      [
        FEASIBILITY_CAVEAT,
        ...(!context
          ? ["Building exclusions are unavailable for this place."]
          : []),
      ]
    );
  } catch {
    return resultFrom(
      null,
      draft,
      ["NO_ELIGIBILITY_LAYER"],
      "low",
      provenanceFor(context, sourceIds),
      [FEASIBILITY_CAVEAT, "Building exclusions could not be resolved."]
    );
  }
}

export { FEASIBILITY_CAVEAT, WETLAND_DISABLED };
