import {
  LIVE_LAND_COVER_SOURCE_IDS,
  MAX_SOCRATA_ROWS,
  SPATIAL_SOURCE_REGISTRY,
  buildSocrataGeoJsonUrl,
} from "../../../src/lib/spatial-data/registry.ts";
import type {
  EdgeSpatialContextResponse,
  SpatialBbox,
  SpatialFeature,
  SpatialSourceDefinition,
} from "../../../src/lib/spatial-data/types.ts";
import type { DataProvenance } from "../../../src/lib/counterfactual/types.ts";

export const MAX_SPATIAL_CONTEXT_AREA_KM2 = 50;

type FetchLike = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

function approximateAreaKm2(bbox: SpatialBbox): number {
  const meanLatitude = ((bbox.north + bbox.south) / 2) * (Math.PI / 180);
  const heightKm = (bbox.north - bbox.south) * 111.32;
  const widthKm =
    (bbox.east - bbox.west) * 111.32 * Math.cos(meanLatitude);
  return heightKm * widthKm;
}

export function validateSpatialContextBbox(value: unknown): SpatialBbox {
  if (!value || typeof value !== "object") {
    throw new Error("bbox must contain numeric coordinates");
  }

  const candidate = value as Record<string, unknown>;
  const bbox = {
    north: candidate.north,
    south: candidate.south,
    east: candidate.east,
    west: candidate.west,
  };
  if (
    !Object.values(bbox).every(
      (coordinate) =>
        typeof coordinate === "number" && Number.isFinite(coordinate)
    )
  ) {
    throw new Error("bbox coordinates must be numeric and finite");
  }

  const ordered = bbox as SpatialBbox;
  if (
    ordered.north <= ordered.south ||
    ordered.east <= ordered.west ||
    ordered.north > 90 ||
    ordered.south < -90 ||
    ordered.east > 180 ||
    ordered.west < -180
  ) {
    throw new Error("bbox coordinates must be ordered within world bounds");
  }
  if (approximateAreaKm2(ordered) > MAX_SPATIAL_CONTEXT_AREA_KM2) {
    throw new Error("bbox exceeds the 50 km² spatial-context limit");
  }
  return ordered;
}

function sourceProvenance(source: SpatialSourceDefinition): DataProvenance {
  return {
    sourceId: source.id,
    title: source.title,
    agency: source.agency,
    url: source.officialUrl,
    observedAt: source.observedAt,
    accessedAt: source.accessedAt,
    spatialResolutionM: source.spatialResolutionM,
    crs: source.crs,
    license: source.license,
    method: source.processingMethod,
    confidence: source.confidence,
    status: source.status,
    caveats: source.caveats,
  };
}

function sourceFeatureId(
  source: SpatialSourceDefinition,
  feature: GeoJSON.Feature,
  index: number
): string {
  const properties = feature.properties ?? {};
  for (const field of source.featureIdFields) {
    const value = properties[field];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  if (typeof feature.id === "string" || typeof feature.id === "number") {
    return String(feature.id);
  }
  return `${source.id}:${index}`;
}

function normalizeGeometry(
  source: SpatialSourceDefinition,
  feature: GeoJSON.Feature
): GeoJSON.Geometry | null {
  if (source.geometryType === "point-fields") {
    const properties = feature.properties ?? {};
    const latitude = Number(properties[source.latitudeField ?? "latitude"]);
    const longitude = Number(properties[source.longitudeField ?? "longitude"]);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }
    return { type: "Point", coordinates: [longitude, latitude] };
  }

  if (
    feature.geometry?.type === "Polygon" ||
    feature.geometry?.type === "MultiPolygon"
  ) {
    return feature.geometry;
  }
  return null;
}

function normalizeFeatures(
  source: SpatialSourceDefinition,
  collection: GeoJSON.FeatureCollection
): SpatialFeature[] {
  if (!source.displayClass) return [];

  return collection.features.flatMap((feature, index) => {
    const geometry = normalizeGeometry(source, feature);
    if (!geometry) return [];
    return [{
      type: "Feature" as const,
      geometry,
      properties: {
        featureId: sourceFeatureId(source, feature, index),
        surfaceClass: source.displayClass,
        sourceId: source.id,
        confidence: source.confidence,
        observedAt: source.observedAt,
        scientificStatus: "observed" as const,
      },
    }];
  });
}

async function fetchSource(
  source: SpatialSourceDefinition,
  bbox: SpatialBbox,
  signal: AbortSignal | undefined,
  fetchImpl: FetchLike
) {
  const response = await fetchImpl(buildSocrataGeoJsonUrl(source, bbox), {
    signal,
    headers: { Accept: "application/geo+json, application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const body = await response.json() as GeoJSON.FeatureCollection;
  if (body?.type !== "FeatureCollection" || !Array.isArray(body.features)) {
    throw new Error("source returned invalid GeoJSON");
  }
  return {
    features: normalizeFeatures(source, body),
    provenance: sourceProvenance(source),
    truncated: body.features.length >= MAX_SOCRATA_ROWS,
  };
}

export async function fetchOfficialSpatialContext(
  bboxValue: unknown,
  signal?: AbortSignal,
  fetchImpl: FetchLike = fetch
): Promise<EdgeSpatialContextResponse> {
  const bbox = validateSpatialContextBbox(bboxValue);
  const sources = LIVE_LAND_COVER_SOURCE_IDS.map(
    (id) => SPATIAL_SOURCE_REGISTRY[id]
  );
  const settled = await Promise.allSettled(
    sources.map((source) => fetchSource(source, bbox, signal, fetchImpl))
  );

  const features: SpatialFeature[] = [];
  const provenance: DataProvenance[] = [];
  const loadedSourceIds: string[] = [];
  const failedSourceIds: string[] = [];
  const warnings: string[] = [];
  settled.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      features.push(...result.value.features);
      provenance.push(result.value.provenance);
      loadedSourceIds.push(source.id);
      if (result.value.truncated) {
        warnings.push(
          `${source.id} reached the ${MAX_SOCRATA_ROWS}-row cap; coverage may be partial.`
        );
      }
    } else {
      failedSourceIds.push(source.id);
      warnings.push(
        `${source.id} failed: ${result.reason instanceof Error ? result.reason.message : "unknown error"}`
      );
    }
  });

  const requestedAreaM2 = approximateAreaKm2(bbox) * 1_000_000;
  return {
    type: "FeatureCollection",
    features,
    coverage: {
      status: loadedSourceIds.length === 0 ? "unavailable" : "partial",
      requestedAreaM2,
      classifiedAreaM2: 0,
    },
    provenance,
    warnings,
    loadedSourceIds,
    failedSourceIds,
  };
}
