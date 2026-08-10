import { bbox as geometryBbox, booleanPointInPolygon } from "@turf/turf";
import type {
  InterventionFeature,
  SurfaceModifierCell,
  SurfaceModifierGrid,
} from "./types";

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface PreparedFeature {
  feature: InterventionFeature;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  bounds: [number, number, number, number];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function validateGrid(bbox: Bounds, rows: number, cols: number): void {
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(cols) ||
    rows <= 0 ||
    cols <= 0
  ) {
    throw new Error("Modifier grid rows and columns must be positive integers");
  }
  if (
    ![bbox.north, bbox.south, bbox.east, bbox.west].every(Number.isFinite) ||
    bbox.north <= bbox.south ||
    bbox.east <= bbox.west
  ) {
    throw new Error("Modifier grid bbox must contain ordered finite coordinates");
  }
}

function prepare(features: InterventionFeature[]): PreparedFeature[] {
  return features.flatMap((candidate) => {
    const geometry = candidate.eligibility.validGeometry;
    if (!candidate.eligibility.eligible || !geometry) return [];
    return [{
      feature: candidate,
      geometry,
      bounds: geometryBbox(geometry) as [number, number, number, number],
    }];
  });
}

function contains(
  prepared: PreparedFeature,
  longitude: number,
  latitude: number
): boolean {
  const [west, south, east, north] = prepared.bounds;
  return (
    longitude >= west &&
    longitude <= east &&
    latitude >= south &&
    latitude <= north &&
    booleanPointInPolygon([longitude, latitude], prepared.geometry)
  );
}

export function rasterizeSurfaceModifiers(
  features: InterventionFeature[],
  bbox: Bounds,
  rows: number,
  cols: number
): SurfaceModifierGrid {
  validateGrid(bbox, rows, cols);
  const prepared = prepare(features);
  if (prepared.length === 0) {
    return { bbox, rows, cols, cells: [] };
  }

  const latitudeStep = (bbox.north - bbox.south) / rows;
  const longitudeStep = (bbox.east - bbox.west) / cols;
  const cells: SurfaceModifierCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    const latitude = bbox.north - (row + 0.5) * latitudeStep;
    for (let col = 0; col < cols; col += 1) {
      const longitude = bbox.west + (col + 0.5) * longitudeStep;
      let retentionFractionDelta = 0;
      let storageDeltaMm = 0;
      let roughnessDelta = 0;

      for (const candidate of prepared) {
        if (!contains(candidate, longitude, latitude)) continue;
        const parameters = candidate.feature.parameters;
        retentionFractionDelta = Math.max(
          retentionFractionDelta,
          clamp01(parameters.retentionFractionDelta)
        );
        storageDeltaMm = Math.max(
          storageDeltaMm,
          Math.max(0, parameters.storageDeltaMm)
        );
        roughnessDelta = Math.max(
          roughnessDelta,
          Math.max(0, parameters.roughnessDelta)
        );
      }

      if (
        retentionFractionDelta > 0 ||
        storageDeltaMm > 0 ||
        roughnessDelta > 0
      ) {
        cells.push({
          row,
          col,
          retentionFractionDelta,
          storageDeltaMm,
          roughnessDelta,
        });
      }
    }
  }

  return { bbox, rows, cols, cells };
}
