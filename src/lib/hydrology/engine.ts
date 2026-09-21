import type { LandCover } from "@/lib/types";
import type {
  FlowPath,
  ImpactPoint,
  RiskZone,
} from "@/lib/simulation-types";
import type { SurfaceModifierCell, SurfaceModifierGrid } from "@/lib/counterfactual/types";
import { runoffCoefficient } from "@/lib/simulation";
import { bboxAreaKm2, type BBox } from "@/lib/geo";
import type {
  LocalStormInput,
  LocalStormResult,
  SimExtent,
} from "./types";
import { LOCAL_GRID, LOCAL_HYDROLOGY_MODEL } from "./types";
import { loadElevationGrid } from "./dem";
import { designStormHydrograph, hydrographPeakM3s } from "./hydrograph";

type Receiver = [number, number];

const MAX_FLOW_PATHS = 80;
const MAX_RISK_ZONES = 220;
const MAX_IMPACT_POINTS = 8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function modifierLookup(
  cells: SurfaceModifierCell[] | undefined
): Map<string, SurfaceModifierCell> {
  return new Map((cells ?? []).map((cell) => [`${cell.row}:${cell.col}`, cell]));
}

function receiverFor(elevation: number[][], row: number, col: number): Receiver {
  const rows = elevation.length;
  const cols = elevation[0].length;
  const current = elevation[row][col];
  let bestSlope = 0;
  let receiver: Receiver = [row, col];
  const neighbors: Receiver[] = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  for (const [rowDelta, colDelta] of neighbors) {
    const nextRow = row + rowDelta;
    const nextCol = col + colDelta;
    if (nextRow < 0 || nextCol < 0 || nextRow >= rows || nextCol >= cols) {
      continue;
    }
    const distance = rowDelta === 0 || colDelta === 0 ? 1 : Math.SQRT2;
    const slope = (current - elevation[nextRow][nextCol]) / distance;
    if (slope > bestSlope) {
      bestSlope = slope;
      receiver = [nextRow, nextCol];
    }
  }
  return receiver;
}

function cellCenter(
  bbox: SimExtent,
  row: number,
  col: number,
  rows: number,
  cols: number
): [number, number] {
  const latitudeStep = (bbox.north - bbox.south) / rows;
  const longitudeStep = (bbox.east - bbox.west) / cols;
  return [
    bbox.west + (col + 0.5) * longitudeStep,
    bbox.north - (row + 0.5) * latitudeStep,
  ];
}

function cellPolygon(
  bbox: SimExtent,
  row: number,
  col: number,
  rows: number,
  cols: number
): [number, number][] {
  const latitudeStep = (bbox.north - bbox.south) / rows;
  const longitudeStep = (bbox.east - bbox.west) / cols;
  const west = bbox.west + col * longitudeStep;
  const east = west + longitudeStep;
  const north = bbox.north - row * latitudeStep;
  const south = north - latitudeStep;
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

function extentAreaKm2(bbox: SimExtent): number {
  const box: BBox = [
    [bbox.west, bbox.south],
    [bbox.east, bbox.north],
  ];
  return bboxAreaKm2(box);
}

function sameModifierExtent(
  modifiers: SurfaceModifierGrid | undefined,
  bbox: SimExtent,
  rows: number,
  cols: number
): boolean {
  if (!modifiers) return true;
  if (modifiers.rows !== rows || modifiers.cols !== cols) return false;
  const { bbox: extent } = modifiers;
  return (
    Math.abs(extent.north - bbox.north) < 1e-8 &&
    Math.abs(extent.south - bbox.south) < 1e-8 &&
    Math.abs(extent.east - bbox.east) < 1e-8 &&
    Math.abs(extent.west - bbox.west) < 1e-8
  );
}

export function routeWatershed(
  input: LocalStormInput & { elevation: NonNullable<LocalStormInput["elevation"]> }
): LocalStormResult {
  const start = Date.now();
  const { bbox, elevation } = input;
  const rows = elevation.rows;
  const cols = elevation.cols;
  if (
    elevation.values.length !== rows ||
    elevation.values.some((row) => row.length !== cols)
  ) {
    throw new Error("Elevation grid is not rectangular.");
  }
  if (input.expectedElevationHash && input.expectedElevationHash !== elevation.hash) {
    throw new Error("Loaded elevation identity does not match the paired NOW elevation.");
  }
  if (!sameModifierExtent(input.modifiers, bbox, rows, cols)) {
    throw new Error("Surface modifier grid must match the simulation extent and resolution.");
  }

  const compositeC = clamp(runoffCoefficient(input.landCover), 0, 1);
  const baselineRetention = 1 - compositeC;
  const cells = rows * cols;
  const cellAreaM2 = (extentAreaKm2(bbox) * 1e6) / cells;
  const rainfallPerCellM3 = (input.rainfallDepthMm / 1000) * cellAreaM2;
  const modifiers = modifierLookup(input.modifiers?.cells);

  const generatedRunoff: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0)
  );
  const roughness: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0)
  );

  let rainfallM3 = 0;
  let infiltratedM3 = 0;
  let storedM3 = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const modifier = modifiers.get(`${row}:${col}`);
      const retention = clamp(
        baselineRetention + (modifier?.retentionFractionDelta ?? 0),
        0,
        1
      );
      const infiltrated = rainfallPerCellM3 * retention;
      const remainingDepthMm = input.rainfallDepthMm * (1 - retention);
      const storageDepthMm = Math.min(
        remainingDepthMm,
        Math.max(0, modifier?.storageDeltaMm ?? 0)
      );
      const stored = (storageDepthMm / 1000) * cellAreaM2;
      const runoff = Math.max(0, rainfallPerCellM3 - infiltrated - stored);
      rainfallM3 += rainfallPerCellM3;
      infiltratedM3 += infiltrated;
      storedM3 += stored;
      generatedRunoff[row][col] = runoff;
      roughness[row][col] = Math.max(0, modifier?.roughnessDelta ?? 0);
    }
  }

  const receivers: Receiver[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) =>
      receiverFor(elevation.values, row, col)
    )
  );
  const accumulation = generatedRunoff.map((row) => [...row]);
  const orderedCells = Array.from({ length: cells }, (_, index) => ({
    row: Math.floor(index / cols),
    col: index % cols,
  })).sort((left, right) => {
    const elevationDifference =
      elevation.values[right.row][right.col] -
      elevation.values[left.row][left.col];
    if (elevationDifference !== 0) return elevationDifference;
    if (left.row !== right.row) return left.row - right.row;
    return left.col - right.col;
  });

  for (const cell of orderedCells) {
    const [nextRow, nextCol] = receivers[cell.row][cell.col];
    if (nextRow !== cell.row || nextCol !== cell.col) {
      accumulation[nextRow][nextCol] += accumulation[cell.row][cell.col];
    }
  }

  const pathThreshold = rainfallPerCellM3 * 4;
  const rawPaths: FlowPath[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (accumulation[row][col] <= pathThreshold) continue;
      const points: [number, number][] = [];
      const visited = new Set<string>();
      let currentRow = row;
      let currentCol = col;
      while (true) {
        const key = `${currentRow}:${currentCol}`;
        if (visited.has(key)) break;
        visited.add(key);
        points.push(cellCenter(bbox, currentRow, currentCol, rows, cols));
        const [nextRow, nextCol] = receivers[currentRow][currentCol];
        if (nextRow === currentRow && nextCol === currentCol) break;
        currentRow = nextRow;
        currentCol = nextCol;
      }
      if (points.length < 2) continue;
      const headDrop = Math.max(
        0,
        elevation.values[row][col] - elevation.values[currentRow][currentCol]
      );
      const baseVelocity = clamp(Math.sqrt(2 * 9.81 * headDrop), 0.5, 10);
      rawPaths.push({
        points,
        volume_m3: accumulation[row][col],
        velocity_mps: clamp(baseVelocity / (1 + roughness[row][col]), 0.1, 10),
      });
    }
  }
  rawPaths.sort((left, right) => right.volume_m3 - left.volume_m3);
  const flow_paths = rawPaths.slice(0, MAX_FLOW_PATHS);

  const ranked: Array<{ row: number; col: number; value: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (accumulation[row][col] > 0) {
        ranked.push({ row, col, value: accumulation[row][col] });
      }
    }
  }
  ranked.sort((left, right) => right.value - left.value);
  const severeCut = ranked[Math.floor(ranked.length * 0.05)]?.value ?? pathThreshold * 3;
  const highCut = ranked[Math.floor(ranked.length * 0.12)]?.value ?? pathThreshold * 2;
  const moderateCut = ranked[Math.floor(ranked.length * 0.28)]?.value ?? pathThreshold * 1.4;

  const risk_zones: RiskZone[] = ranked
    .filter((cell) => cell.value >= moderateCut)
    .slice(0, MAX_RISK_ZONES)
    .map((cell) => ({
      polygon: cellPolygon(bbox, cell.row, cell.col, rows, cols),
      level:
        cell.value >= severeCut
          ? "severe"
          : cell.value >= highCut
            ? "high"
            : "moderate",
      affected_area_km2: cellAreaM2 / 1e6,
    }));

  const impact_points: ImpactPoint[] = ranked.slice(0, MAX_IMPACT_POINTS).map((cell) => {
    const floodDepth = clamp(cell.value / Math.max(cellAreaM2, 1e-6), 0, 4);
    return {
      location: cellCenter(bbox, cell.row, cell.col, rows, cols),
      accumulated_volume_m3: cell.value,
      flood_depth_m: floodDepth,
      risk_level:
        cell.value >= severeCut
          ? "severe"
          : cell.value >= highCut
            ? "high"
            : "moderate",
    };
  });

  const runoffM3 = Math.max(0, rainfallM3 - infiltratedM3 - storedM3);
  const closureErrorM3 = Math.abs(rainfallM3 - infiltratedM3 - storedM3 - runoffM3);
  const hydrograph = designStormHydrograph(
    runoffM3,
    input.rainfallDepthMm,
    input.durationMinutes
  );
  const peakDischargeM3s = hydrographPeakM3s(hydrograph);
  const warnings = [...elevation.warnings];
  if (elevation.status === "illustrative") {
    warnings.push(
      "Optimization claims are disabled while the terrain surface is illustrative."
    );
  }

  const metadata = {
    processed_area_km2: Math.round(extentAreaKm2(bbox) * 1000) / 1000,
    cells_analyzed: cells,
    computation_time_ms: Date.now() - start,
    runoff_volume_m3: runoffM3,
    infiltrated_volume_m3: infiltratedM3,
    rainfall_volume_m3: rainfallM3,
    stored_volume_m3: storedM3,
    peak_discharge_m3s: peakDischargeM3s,
    hydrograph,
    elevation_status: elevation.status,
    elevation_hash: elevation.hash,
    model: LOCAL_HYDROLOGY_MODEL,
    surface_id: input.surfaceId,
    land_cover_c: compositeC,
  };

  return {
    flow_paths,
    risk_zones,
    impact_points,
    metadata,
    waterBalance: {
      rainfallM3,
      infiltratedM3,
      storedM3,
      runoffM3,
      closureErrorM3,
    },
    hydrograph,
    peakDischargeM3s,
    compositeRunoffC: compositeC,
    elevationHash: elevation.hash,
    elevationStatus: elevation.status,
    modelVersion: LOCAL_HYDROLOGY_MODEL,
    surfaceId: input.surfaceId,
    warnings,
  };
}

export async function runLocalStorm(
  input: LocalStormInput,
  fetchImpl?: typeof fetch
): Promise<LocalStormResult> {
  const size = LOCAL_GRID[input.resolution];
  const elevation =
    input.elevation ??
    (await loadElevationGrid(input.bbox, size, size, fetchImpl ?? fetch));
  if (elevation.rows !== size || elevation.cols !== size) {
    throw new Error(`Elevation grid must be ${size}×${size} for ${input.resolution} resolution.`);
  }
  return routeWatershed({ ...input, elevation });
}
