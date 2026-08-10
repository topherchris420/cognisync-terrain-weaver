import {
  area,
  bboxPolygon,
  difference,
  featureCollection,
} from "@turf/turf";
import type { DataProvenance } from "@/lib/counterfactual/types";
import type {
  EdgeSpatialContextResponse,
  SpatialBbox,
  SpatialContextResult,
  SpatialFeature,
  SpatialFeatureProperties,
} from "./types";

const DERIVED_SOURCE_ID = "derived-unclassified";

function isSpatialProperties(
  value: unknown
): value is SpatialFeatureProperties {
  if (!value || typeof value !== "object") return false;
  const properties = value as Record<string, unknown>;
  return (
    typeof properties.featureId === "string" &&
    typeof properties.sourceId === "string" &&
    ["buildings", "pavement", "water", "tree-observation", "unclassified"].includes(
      String(properties.surfaceClass)
    ) &&
    ["high", "medium", "low"].includes(String(properties.confidence)) &&
    ["observed", "derived"].includes(String(properties.scientificStatus))
  );
}

function validateEdgeResponse(value: unknown): EdgeSpatialContextResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Spatial context response must be a FeatureCollection");
  }
  const response = value as Partial<EdgeSpatialContextResponse>;
  if (response.type !== "FeatureCollection" || !Array.isArray(response.features)) {
    throw new Error("Spatial context response must be a FeatureCollection");
  }
  if (
    !response.features.every(
      (feature) =>
        feature?.type === "Feature" &&
        feature.geometry &&
        isSpatialProperties(feature.properties)
    )
  ) {
    throw new Error("Spatial context response contains invalid features");
  }
  return {
    type: "FeatureCollection",
    features: response.features as SpatialFeature[],
    coverage: response.coverage ?? {
      status: "unavailable",
      requestedAreaM2: 0,
      classifiedAreaM2: 0,
    },
    provenance: Array.isArray(response.provenance) ? response.provenance : [],
    warnings: Array.isArray(response.warnings) ? response.warnings : [],
    loadedSourceIds: Array.isArray(response.loadedSourceIds)
      ? response.loadedSourceIds
      : [],
    failedSourceIds: Array.isArray(response.failedSourceIds)
      ? response.failedSourceIds
      : [],
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function normalizeSpatialContext(
  responses: readonly EdgeSpatialContextResponse[],
  bbox: SpatialBbox
): SpatialContextResult {
  const validated = responses.map(validateEdgeResponse);
  const observedFeatures = validated.flatMap((response) => response.features);
  const requested = bboxPolygon([bbox.west, bbox.south, bbox.east, bbox.north]);
  const polygonFeatures = observedFeatures.filter(
    (feature): feature is GeoJSON.Feature<
      GeoJSON.Polygon | GeoJSON.MultiPolygon,
      SpatialFeatureProperties
    > =>
      feature.geometry.type === "Polygon" ||
      feature.geometry.type === "MultiPolygon"
  );

  let remainder: GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon
  > | null = requested;
  if (polygonFeatures.length > 0) {
    try {
      remainder = difference(
        featureCollection([requested, ...polygonFeatures])
      );
    } catch {
      remainder = requested;
    }
  }

  const requestedAreaM2 = area(requested);
  const unclassifiedAreaM2 = remainder ? area(remainder) : 0;
  const classifiedAreaM2 = Math.max(
    0,
    requestedAreaM2 - unclassifiedAreaM2
  );
  const unclassified: SpatialFeature[] = remainder
    ? [{
        type: "Feature",
        geometry: remainder.geometry,
        properties: {
          featureId: DERIVED_SOURCE_ID,
          surfaceClass: "unclassified",
          sourceId: DERIVED_SOURCE_ID,
          confidence: "low",
          scientificStatus: "derived",
        },
      }]
    : [];

  const loadedSourceIds = unique(
    validated.flatMap((response) => response.loadedSourceIds)
  );
  const failedSourceIds = unique(
    validated.flatMap((response) => response.failedSourceIds)
  );
  const coverageStatus =
    loadedSourceIds.length === 0
      ? "unavailable"
      : failedSourceIds.length > 0 || unclassifiedAreaM2 > 0.01
      ? "partial"
      : "complete";
  const warnings = unique([
    ...validated.flatMap((response) => response.warnings),
    ...(coverageStatus === "partial"
      ? ["Official vector coverage is partial; remaining area is unclassified."]
      : []),
    ...(coverageStatus === "unavailable"
      ? ["Official spatial context is unavailable for this request."]
      : []),
  ]);
  const derivedProvenance: DataProvenance[] = unclassified.length
    ? [{
        sourceId: DERIVED_SOURCE_ID,
        title: "Unclassified requested area",
        agency: "Mannahatta Counterfactual Engine",
        url: "",
        accessedAt: new Date().toISOString(),
        method: "Requested bbox minus loaded official polygon classes.",
        confidence: "low",
        status: "derived",
        caveats: [
          "Unclassified area is not inferred land cover.",
          ...failedSourceIds.map((id) => `Missing source: ${id}`),
        ],
      }]
    : [];

  return {
    featureCollection: {
      type: "FeatureCollection",
      features: [...observedFeatures, ...unclassified],
    },
    coverage: {
      status: coverageStatus,
      requestedAreaM2,
      classifiedAreaM2,
    },
    provenance: [
      ...validated.flatMap((response) => response.provenance),
      ...derivedProvenance,
    ],
    warnings,
    loadedSourceIds,
    failedSourceIds,
  };
}

export async function loadSpatialContext(
  bbox: SpatialBbox,
  signal?: AbortSignal
): Promise<SpatialContextResult> {
  const baseUrl =
    import.meta.env.VITE_SUPABASE_URL || "http://localhost:54321";
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const response = await fetch(`${baseUrl}/functions/v1/spatial-context`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(anonKey ? {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      } : {}),
    },
    body: JSON.stringify({ bbox }),
  });
  if (!response.ok) {
    throw new Error(`Spatial context request failed with HTTP ${response.status}`);
  }
  const edgeResponse = validateEdgeResponse(await response.json());
  return normalizeSpatialContext([edgeResponse], bbox);
}
