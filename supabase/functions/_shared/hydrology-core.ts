import {
  HYDROLOGY_MODEL_VERSION,
  bboxAreaKm2,
  validateSimulationRequest,
  type HydrologyFlowPath,
  type HydrologyInput,
  type HydrologyModifierCell,
  type HydrologyProvenance,
  type HydrologyRiskZone,
  type SimBBox,
  type SimulationResponseV2,
} from "./hydrology-contract";

type Receiver = [number, number];

function elevationHash(elevation: number[][]): string {
  const serialized = JSON.stringify(elevation);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= BigInt(serialized.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function matrix(rows: number, cols: number, initial = 0): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(initial));
}

function assertElevation(input: HydrologyInput): void {
  const { rows, cols } = input.request.surface.modifiers;
  if (
    input.elevation.length !== rows ||
    input.elevation.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== cols ||
        row.some((value) => !Number.isFinite(value))
    )
  ) {
    throw new Error(
      `Elevation dimensions must match the ${rows} by ${cols} modifier grid.`
    );
  }
}

function modifierLookup(
  cells: HydrologyModifierCell[]
): Map<string, HydrologyModifierCell> {
  return new Map(cells.map((cell) => [`${cell.row}:${cell.col}`, cell]));
}

function receiverFor(
  elevation: number[][],
  row: number,
  col: number
): Receiver {
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
    if (
      nextRow < 0 ||
      nextCol < 0 ||
      nextRow >= rows ||
      nextCol >= cols
    ) {
      continue;
    }
    const distance =
      rowDelta === 0 || colDelta === 0 ? 1 : Math.SQRT2;
    const slope =
      (current - elevation[nextRow][nextCol]) / distance;
    if (slope > bestSlope) {
      bestSlope = slope;
      receiver = [nextRow, nextCol];
    }
  }
  return receiver;
}

function cellCenter(
  bbox: SimBBox,
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
  bbox: SimBBox,
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

function riskThreshold(
  descending: number[],
  share: number,
  fallback: number
): number {
  if (descending.length === 0) return fallback;
  const index = Math.min(
    descending.length - 1,
    Math.floor(descending.length * share)
  );
  return descending[index] ?? fallback;
}

function derivedElevationProvenance(
  provenance: HydrologyProvenance
): HydrologyProvenance {
  return {
    ...provenance,
    confidence: "low",
    status: "derived",
    method: "Deterministic slope-from-coordinate fallback",
    caveats: Array.from(
      new Set([
        ...provenance.caveats,
        "Illustrative synthetic elevation; not a surveyed terrain surface.",
      ])
    ),
  };
}

function combineProvenance(
  surface: HydrologyProvenance[],
  elevation: HydrologyProvenance
): HydrologyProvenance[] {
  const combined = new Map<string, HydrologyProvenance>();
  for (const item of surface) combined.set(item.sourceId, item);
  combined.set(elevation.sourceId, elevation);
  return [...combined.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId)
  );
}

export function runHydrology(input: HydrologyInput): SimulationResponseV2 {
  const request = validateSimulationRequest(input.request);
  assertElevation(input);
  const loadedElevationHash = elevationHash(input.elevation);
  if (
    request.expectedElevationHash !== undefined &&
    request.expectedElevationHash !== loadedElevationHash
  ) {
    throw new Error(
      "Loaded elevation identity does not match the paired NOW elevation."
    );
  }
  const { bbox, storm, surface } = request;
  const { rows, cols } = surface.modifiers;
  const cells = rows * cols;
  const cellAreaM2 = (bboxAreaKm2(bbox) * 1e6) / cells;
  const rainfallPerCellM3 =
    (storm.rainfallDepthMm / 1000) * cellAreaM2;
  const modifiers = modifierLookup(surface.modifiers.cells);
  const generatedRunoff = matrix(rows, cols);
  const roughness = matrix(rows, cols);
  let rainfallM3 = 0;
  let infiltratedM3 = 0;
  let storedM3 = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const modifier = modifiers.get(`${row}:${col}`);
      const retention = clamp(
        modifier?.retentionFractionDelta ?? 0,
        0,
        1
      );
      const infiltrated = rainfallPerCellM3 * retention;
      const remainingDepthMm =
        storm.rainfallDepthMm * (1 - retention);
      const storageDepthMm = Math.min(
        remainingDepthMm,
        modifier?.storageDeltaMm ?? 0
      );
      const stored = (storageDepthMm / 1000) * cellAreaM2;
      const runoff = Math.max(
        0,
        rainfallPerCellM3 - infiltrated - stored
      );
      rainfallM3 += rainfallPerCellM3;
      infiltratedM3 += infiltrated;
      storedM3 += stored;
      generatedRunoff[row][col] = runoff;
      roughness[row][col] = modifier?.roughnessDelta ?? 0;
    }
  }

  const receivers: Receiver[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) =>
      receiverFor(input.elevation, row, col)
    )
  );
  const accumulation = generatedRunoff.map((row) => [...row]);
  const orderedCells = Array.from({ length: cells }, (_, index) => ({
    row: Math.floor(index / cols),
    col: index % cols,
  })).sort((left, right) => {
    const elevationDifference =
      input.elevation[right.row][right.col] -
      input.elevation[left.row][left.col];
    if (elevationDifference !== 0) return elevationDifference;
    if (left.row !== right.row) return left.row - right.row;
    return left.col - right.col;
  });

  for (const cell of orderedCells) {
    const [nextRow, nextCol] = receivers[cell.row][cell.col];
    if (nextRow !== cell.row || nextCol !== cell.col) {
      accumulation[nextRow][nextCol] +=
        accumulation[cell.row][cell.col];
    }
  }

  const pathThreshold = rainfallPerCellM3 * 5;
  const flowPaths: HydrologyFlowPath[] = [];
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
        points.push(
          cellCenter(
            bbox,
            currentRow,
            currentCol,
            rows,
            cols
          )
        );
        const [nextRow, nextCol] =
          receivers[currentRow][currentCol];
        if (
          nextRow === currentRow &&
          nextCol === currentCol
        ) {
          break;
        }
        currentRow = nextRow;
        currentCol = nextCol;
      }
      if (points.length < 2) continue;
      const headDrop = Math.max(
        0,
        input.elevation[row][col] -
          input.elevation[currentRow][currentCol]
      );
      const baseVelocity = clamp(
        Math.sqrt(2 * 9.81 * headDrop),
        0.5,
        10
      );
      flowPaths.push({
        points,
        volume_m3: accumulation[row][col],
        velocity_mps: clamp(
          baseVelocity / (1 + roughness[row][col]),
          0.1,
          10
        ),
      });
    }
  }

  const positiveAccumulations = accumulation
    .flat()
    .filter((value) => value > 0)
    .sort((left, right) => right - left);
  const severeThreshold = riskThreshold(
    positiveAccumulations,
    0.05,
    pathThreshold * 3
  );
  const highThreshold = riskThreshold(
    positiveAccumulations,
    0.15,
    pathThreshold * 2
  );
  const moderateThreshold = riskThreshold(
    positiveAccumulations,
    0.3,
    pathThreshold * 1.5
  );
  const riskZones: HydrologyRiskZone[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const value = accumulation[row][col];
      if (value < moderateThreshold) continue;
      const level =
        value >= severeThreshold
          ? "severe"
          : value >= highThreshold
            ? "high"
            : "moderate";
      riskZones.push({
        polygon: cellPolygon(bbox, row, col, rows, cols),
        level,
        affected_area_km2: cellAreaM2 / 1e6,
      });
    }
  }

  const runoffM3 = Math.max(
    0,
    rainfallM3 - infiltratedM3 - storedM3
  );
  const closureErrorM3 = Math.abs(
    rainfallM3 - infiltratedM3 - storedM3 - runoffM3
  );
  const tolerance = Math.max(1e-6, rainfallM3 * 1e-6);
  if (closureErrorM3 > tolerance) {
    throw new Error(
      `Hydrology water balance failed to close: ${closureErrorM3} m3.`
    );
  }

  const illustrative = input.elevationStatus === "illustrative";
  const elevationProvenance = illustrative
    ? derivedElevationProvenance(input.elevationProvenance)
    : input.elevationProvenance;
  return {
    flow_paths: flowPaths,
    risk_zones: riskZones,
    impact_points: [],
    metadata: {
      processed_area_km2:
        Math.round(bboxAreaKm2(bbox) * 100) / 100,
      cells_analyzed: cells,
      computation_time_ms: 0,
    },
    stormHash: storm.hash,
    surfaceHash: surface.surfaceHash,
    modelVersion: HYDROLOGY_MODEL_VERSION,
    elevationHash: loadedElevationHash,
    elevationStatus: input.elevationStatus,
    waterBalance: {
      rainfallM3,
      infiltratedM3,
      storedM3,
      runoffM3,
      closureErrorM3,
    },
    optimizationClaimsAllowed: !illustrative,
    warnings: illustrative
      ? [
          "Illustrative synthetic elevation is in use; modeled optimization claims are disabled.",
        ]
      : [],
    provenance: combineProvenance(
      surface.provenance,
      elevationProvenance
    ),
  };
}
