import { bbox as geometryBbox, bboxPolygon, booleanPointInPolygon, feature as turfFeature, featureCollection, intersect } from "@turf/turf";
import type {
  DataProvenance,
  InterventionFeature,
  RealitySurface,
  SurfaceModifierCell,
  SurfaceModifierGrid,
} from "./types";
import { stableHash } from "./hashing";
import { combineProvenance } from "./provenance";

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
  vertices: [number, number][];
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
    const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
    return [{
      feature: candidate,
      geometry,
      bounds: geometryBbox(geometry) as [number, number, number, number],
      vertices: rings.flat() as [number, number][],
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

/**
 * Each cell's modifier is weighted by the share of the cell the drawing
 * covers, so a polygon covering 40% of a cell changes it by 40% of its
 * effect. Without this, credited area depended on grid resolution
 * (hydrology/H1: 174% / 87% / 94% of the drawn area at 36 / 72 / 120 cells).
 * Coverage is exact (polygon ∩ cell) where one drawing touches a cell, and a
 * 16 × 16 point lattice where overlapping drawings must not stack.
 */
export const MODIFIER_SUBSAMPLES = 16;

/**
 * Version of the cell-coverage rule, recorded in exports so a replay knows
 * which rule produced the intervention surface identity it is checking.
 *
 * v2 (2026-10-12): the coverage of a partially covered cell is the ratio of
 * planar (longitude/latitude) areas, computed with the shoelace formula on
 * coordinates translated to the cell's corner. v1 divided two spherical
 * areas from @turf/area, whose trigonometry is correctly rounded differently
 * by different JavaScript engines; the formula's large cancelling terms
 * amplified those last-bit differences to about 3e-10 of the coverage, so the
 * same drawing hashed to a different surface identity in Chromium 141 and
 * Node 22 (7 of 49 cells in one measured study). Planar area uses only
 * addition, subtraction and multiplication, which every engine rounds
 * identically; within one cell the metric scale varies by under 1e-4, far
 * below any hydrological meaning, and it cancels in the ratio.
 */
export const MODIFIER_RASTERIZER_VERSION = "cell-coverage-v2";

/**
 * Planar (shoelace) area of a polygon in its own coordinates, holes
 * subtracted, with coordinates translated to `origin` first so the sum does
 * not cancel catastrophically for a cell-sized shape. Only +, − and ×: the
 * same bits on every IEEE-754 engine.
 */
export function planarArea(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon, origin: [number, number] = [0, 0]): number {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let total = 0;
  for (const rings of polygons) {
    rings.forEach((ring, index) => {
      let twice = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const xj = ring[j][0] - origin[0];
        const yj = ring[j][1] - origin[1];
        const xi = ring[i][0] - origin[0];
        const yi = ring[i][1] - origin[1];
        twice += xj * yi - xi * yj;
      }
      const ringArea = Math.abs(twice) / 2;
      total += index === 0 ? ringArea : -ringArea;
    });
  }
  return Math.max(0, total);
}

function exactCoverage(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon, cell: [number, number, number, number]): number | null {
  try {
    const box = bboxPolygon(cell);
    const overlap = intersect(featureCollection([turfFeature(geometry), box]));
    if (!overlap) return 0;
    const boxArea = (cell[2] - cell[0]) * (cell[3] - cell[1]);
    if (!(boxArea > 0)) return 0;
    return Math.min(1, planarArea(overlap.geometry, [cell[0], cell[1]]) / boxArea);
  } catch {
    return null;
  }
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
  const n = MODIFIER_SUBSAMPLES;
  const samples = n * n;
  const west = Math.min(...prepared.map((p) => p.bounds[0]));
  const south = Math.min(...prepared.map((p) => p.bounds[1]));
  const east = Math.max(...prepared.map((p) => p.bounds[2]));
  const north = Math.max(...prepared.map((p) => p.bounds[3]));
  const rowStart = Math.max(0, Math.floor((bbox.north - north) / latitudeStep));
  const rowEnd = Math.min(rows - 1, Math.floor((bbox.north - south) / latitudeStep));
  const colStart = Math.max(0, Math.floor((west - bbox.west) / longitudeStep));
  const colEnd = Math.min(cols - 1, Math.floor((east - bbox.west) / longitudeStep));
  const cells: SurfaceModifierCell[] = [];

  // Cells holding a polygon vertex can never be classified from corners alone.
  const vertexCells = prepared.map((p) => new Set(p.vertices.map(([x, y]) => `${Math.floor((bbox.north - y) / latitudeStep)}:${Math.floor((x - bbox.west) / longitudeStep)}`)));
  const overlaps = (p: PreparedFeature, w: number, sth: number, e: number, nth: number) =>
    p.bounds[0] <= e && p.bounds[2] >= w && p.bounds[1] <= nth && p.bounds[3] >= sth;

  // Corners are tested a millionth of a cell inside, so a drawing that
  // coincides with the extent edge is not split by floating-point rounding.
  const insetLat = latitudeStep * 1e-6;
  const insetLon = longitudeStep * 1e-6;

  for (let row = rowStart; row <= rowEnd; row += 1) {
    const cellNorth = bbox.north - row * latitudeStep;
    const cellSouth = cellNorth - latitudeStep;
    for (let col = colStart; col <= colEnd; col += 1) {
      const cellWest = bbox.west + col * longitudeStep;
      const cellEast = cellWest + longitudeStep;
      const touching = prepared.filter((p) => overlaps(p, cellWest, cellSouth, cellEast, cellNorth));
      if (touching.length === 0) continue;
      let retention = 0;
      let storage = 0;
      let roughness = 0;
      const only = touching.length === 1 ? touching[0] : null;
      let coverage: number | null = null;
      const fullyInside =
        only !== null &&
        !vertexCells[prepared.indexOf(only)].has(`${row}:${col}`) &&
        contains(only, cellWest + insetLon, cellSouth + insetLat) &&
        contains(only, cellEast - insetLon, cellSouth + insetLat) &&
        contains(only, cellEast - insetLon, cellNorth - insetLat) &&
        contains(only, cellWest + insetLon, cellNorth - insetLat);
      if (fullyInside) {
        // A simple polygon edge cannot cross a cell without leaving a corner
        // outside or a vertex inside it, so this cell is covered exactly.
        retention = clamp01(only.feature.parameters.retentionFractionDelta) * samples;
        storage = Math.max(0, only.feature.parameters.storageDeltaMm) * samples;
        roughness = Math.max(0, only.feature.parameters.roughnessDelta) * samples;
      } else if (only && (coverage = exactCoverage(only.geometry, [cellWest, cellSouth, cellEast, cellNorth])) !== null) {
        retention = clamp01(only.feature.parameters.retentionFractionDelta) * coverage * samples;
        storage = Math.max(0, only.feature.parameters.storageDeltaMm) * coverage * samples;
        roughness = Math.max(0, only.feature.parameters.roughnessDelta) * coverage * samples;
      } else {
        for (let i = 0; i < n; i += 1) {
          const latitude = cellNorth - ((i + 0.5) / n) * latitudeStep;
          for (let j = 0; j < n; j += 1) {
            const longitude = cellWest + ((j + 0.5) / n) * longitudeStep;
            // Overlapping drawings never stack: each point takes the strongest.
            let r = 0;
            let st = 0;
            let g = 0;
            for (const candidate of touching) {
              if (!contains(candidate, longitude, latitude)) continue;
              const parameters = candidate.feature.parameters;
              r = Math.max(r, clamp01(parameters.retentionFractionDelta));
              st = Math.max(st, Math.max(0, parameters.storageDeltaMm));
              g = Math.max(g, Math.max(0, parameters.roughnessDelta));
            }
            retention += r;
            storage += st;
            roughness += g;
          }
        }
      }
      if (retention > 0 || storage > 0 || roughness > 0) {
        cells.push({
          row,
          col,
          retentionFractionDelta: retention / samples,
          storageDeltaMm: storage / samples,
          roughnessDelta: roughness / samples,
        });
      }
    }
  }

  return { bbox, rows, cols, cells };
}

export interface BuildRealitySurfaceInput {
  id: "now" | "possible";
  baselineLayerHash: string;
  bbox: Bounds;
  rows: number;
  cols: number;
  features: InterventionFeature[];
  provenance: DataProvenance[];
  warnings: string[];
}

function physicalInterventionIdentity(feature: InterventionFeature) {
  return {
    type: feature.type,
    geometry: feature.geometry,
    validGeometry: feature.eligibility.validGeometry,
    invalidGeometry: feature.eligibility.invalidGeometry,
    parameters: feature.parameters,
    eligibility: {
      eligible: feature.eligibility.eligible,
      reasonCodes: [...feature.eligibility.reasonCodes].sort(),
      confidence: feature.eligibility.confidence,
    },
  };
}

export function buildRealitySurface(
  input: BuildRealitySurfaceInput
): RealitySurface {
  const physicalInterventions = input.features
    .map(physicalInterventionIdentity)
    .sort((left, right) =>
      stableHash(left).localeCompare(stableHash(right))
    );
  const interventionHash = stableHash(physicalInterventions);
  const modifiers = rasterizeSurfaceModifiers(
    input.features,
    input.bbox,
    input.rows,
    input.cols
  );
  const provenance = combineProvenance([
    ...input.provenance,
    ...input.features.flatMap((feature) => [
      ...feature.provenance,
      ...feature.eligibility.provenance,
      ...feature.parameters.calibrationProvenance,
    ]),
  ]);
  const surfaceHash = stableHash({
    baselineLayerHash: input.baselineLayerHash,
    bbox: input.bbox,
    rows: input.rows,
    cols: input.cols,
    interventionHash,
    cells: modifiers.cells,
  });

  return {
    id: input.id,
    baselineLayerHash: input.baselineLayerHash,
    interventionHash,
    surfaceHash,
    interventions: [...input.features],
    modifiers,
    provenance,
    warnings: Array.from(new Set(input.warnings)),
  };
}
