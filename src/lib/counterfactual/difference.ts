import type { StormCellGrid, SimExtent } from "@/lib/hydrology/types";
import type { SimulationResponse } from "@/lib/simulation-types";
import { controlledComparison } from "./controlled";

/**
 * WHERE THE WATER MOVED.
 *
 * A controlled NOW / POSSIBLE pair differs in exactly one thing: the drawn
 * surface. Subtracting the two routed fields cell by cell therefore shows the
 * redesign's whole footprint on the water: the cells whose own runoff changed
 * (the drawing) and the cells downstream that receive less because of it.
 *
 * The difference is only computed for a pair that passes the controlled
 * comparison. Two runs that differ in storm, terrain, land cover, resolution,
 * model or substrate have no spatial difference worth drawing: it would be a
 * difference in forcing, dressed as an effect.
 *
 * Everything here is routed accumulation: where this model sends water, not
 * where flooding is more or less likely (routing/R5). The caveat travels with
 * every use of this module.
 */

/** A routed run that still carries its per-cell grids (an in-memory LocalStormResult). */
export type CellularRun = SimulationResponse & { cells: StormCellGrid };

/** Differences smaller than this (m³) are floating-point noise, not water. */
export const DIFFERENCE_EPSILON_M3 = 1e-9;

/** Cells drawn on the map at most; the largest changes come first. */
export const MAX_DIFFERENCE_CELLS = 5000;

export const SPATIAL_DIFFERENCE_CAVEAT =
  "Differences in routed accumulation under an identical storm, terrain, land cover and model. They show where this model sends less or more water, not where flooding becomes less or more likely.";

export function hasCells(run: SimulationResponse | null | undefined): run is CellularRun {
  const cells = (run as Partial<CellularRun> | null | undefined)?.cells;
  return Boolean(
    cells &&
      Number.isInteger(cells.rows) &&
      Number.isInteger(cells.cols) &&
      cells.rows > 0 &&
      cells.cols > 0 &&
      Array.isArray(cells.generatedM3) &&
      Array.isArray(cells.accumulationM3) &&
      cells.generatedM3.length === cells.rows &&
      cells.accumulationM3.length === cells.rows,
  );
}

export interface DifferenceCell {
  row: number;
  col: number;
  /** Water passing through the cell in NOW, m³. */
  nowM3: number;
  /** Water passing through the cell in POSSIBLE, m³. */
  possibleM3: number;
  /** POSSIBLE − NOW, m³. Negative means less water passes here on the redesigned surface. */
  deltaM3: number;
  /** "source": the drawing changed what this cell itself generates. "downstream": only what arrives here changed. */
  kind: "source" | "downstream";
  /** Straight-line distance, centre to centre, to the nearest source cell (m); 0 for a source cell. */
  reachM: number;
}

export interface SpatialDifferenceSummary {
  /** Cells in the routed grid. */
  cells: number;
  /** Cells whose accumulation differs by more than the epsilon. */
  changed: number;
  /** Cells carrying less water on the redesigned surface. */
  less: number;
  /** Cells carrying more water on the redesigned surface. */
  more: number;
  /** Changed cells whose own generated runoff changed: the drawing's footprint on the grid. */
  sourceCells: number;
  /** Changed cells that only receive different water from upstream. */
  downstreamCells: number;
  /** Straight-line distance from the farthest changed downstream cell to the nearest source cell, m. */
  farthestReachM: number;
  /** The largest reduction in water passing through one cell, m³ (a magnitude). */
  largestDecreaseM3: number;
  /** The largest increase in water passing through one cell, m³ (a magnitude; 0 for a pure retention redesign). */
  largestIncreaseM3: number;
  /** Σ (POSSIBLE − NOW) generated runoff over the grid, m³: the avoided runoff, negative. */
  generatedDeltaM3: number;
  /** Σ (POSSIBLE − NOW) accumulation over changed cells, m³. Water is counted at every cell it passes, so this is a passage total, not a volume. */
  passageDeltaM3: number;
}

export type SpatialDifference =
  | {
      status: "controlled";
      rows: number;
      cols: number;
      cellAreaM2: number;
      /** Changed cells, largest |delta| first. */
      cells: DifferenceCell[];
      summary: SpatialDifferenceSummary;
      caveat: typeof SPATIAL_DIFFERENCE_CAVEAT;
    }
  | { status: "not-controlled"; violations: string[] }
  | { status: "unavailable"; reason: string };

const round6 = (value: number) => {
  const r = Math.round(value * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
};

/**
 * Cell-by-cell difference of two routed runs. Refuses pairs that are not a
 * controlled comparison, and runs that no longer carry their grids (an
 * export, for instance, which a replay must recompute first).
 */
export function spatialDifference(now: SimulationResponse, possible: SimulationResponse): SpatialDifference {
  const control = controlledComparison(now, possible);
  if (!control.valid) return { status: "not-controlled", violations: control.violations };
  if (!hasCells(now) || !hasCells(possible)) {
    return { status: "unavailable", reason: "Per-cell water is not available for both runs; replay the pair to recompute it." };
  }
  const a = now.cells;
  const b = possible.cells;
  if (a.rows !== b.rows || a.cols !== b.cols || a.generatedM3.some((row, r) => row.length !== a.cols || b.generatedM3[r].length !== a.cols)) {
    return { status: "unavailable", reason: "The two runs were routed on different grids." };
  }
  const { rows, cols, cellAreaM2 } = a;
  const side = Math.sqrt(Math.max(cellAreaM2, 0));
  const eps = DIFFERENCE_EPSILON_M3;

  const sources: Array<[number, number]> = [];
  const changed: Array<Omit<DifferenceCell, "reachM">> = [];
  let generatedDelta = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const generated = b.generatedM3[row][col] - a.generatedM3[row][col];
      generatedDelta += generated;
      const nowM3 = a.accumulationM3[row][col];
      const possibleM3 = b.accumulationM3[row][col];
      const deltaM3 = possibleM3 - nowM3;
      const source = Math.abs(generated) > eps;
      if (source) sources.push([row, col]);
      if (Math.abs(deltaM3) <= eps && !source) continue;
      changed.push({ row, col, nowM3, possibleM3, deltaM3, kind: source ? "source" : "downstream" });
    }
  }

  const reach = (row: number, col: number): number => {
    let best = Number.POSITIVE_INFINITY;
    for (const [r, c] of sources) {
      const d = Math.hypot(r - row, c - col);
      if (d < best) best = d;
    }
    return Number.isFinite(best) ? best * side : 0;
  };
  const cells: DifferenceCell[] = changed
    .map((cell) => ({ ...cell, reachM: cell.kind === "source" ? 0 : reach(cell.row, cell.col) }))
    .sort((x, y) => Math.abs(y.deltaM3) - Math.abs(x.deltaM3) || x.row - y.row || x.col - y.col);

  const downstream = cells.filter((c) => c.kind === "downstream");
  const summary: SpatialDifferenceSummary = {
    cells: rows * cols,
    changed: cells.length,
    less: cells.filter((c) => c.deltaM3 < -eps).length,
    more: cells.filter((c) => c.deltaM3 > eps).length,
    sourceCells: sources.length,
    downstreamCells: downstream.length,
    farthestReachM: round6(downstream.reduce((max, c) => Math.max(max, c.reachM), 0)),
    largestDecreaseM3: round6(Math.max(0, ...cells.map((c) => -c.deltaM3))),
    largestIncreaseM3: round6(Math.max(0, ...cells.map((c) => c.deltaM3))),
    generatedDeltaM3: round6(generatedDelta),
    passageDeltaM3: round6(cells.reduce((sum, c) => sum + c.deltaM3, 0)),
  };
  return { status: "controlled", rows, cols, cellAreaM2, cells, summary, caveat: SPATIAL_DIFFERENCE_CAVEAT };
}

/** The summary alone, for an evidence export; null when the pair has no controlled spatial difference. */
export function spatialDifferenceSummary(now: SimulationResponse | null, possible: SimulationResponse | null): SpatialDifferenceSummary | null {
  if (!now || !possible) return null;
  const difference = spatialDifference(now, possible);
  return difference.status === "controlled" ? difference.summary : null;
}

export interface DifferenceFeatureProperties {
  row: number;
  col: number;
  delta_m3: number;
  now_m3: number;
  possible_m3: number;
  kind: "source" | "downstream";
  reach_m: number;
  /** |delta| relative to the largest change in this comparison, 0–1, for styling. */
  share: number;
}

function cellRing(extent: SimExtent, row: number, col: number, rows: number, cols: number): [number, number][] {
  const latitudeStep = (extent.north - extent.south) / rows;
  const longitudeStep = (extent.east - extent.west) / cols;
  const west = extent.west + col * longitudeStep;
  const east = west + longitudeStep;
  const north = extent.north - row * latitudeStep;
  const south = north - latitudeStep;
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

/** Changed cells as polygons on the routed extent, largest changes first, capped for the renderer. */
export function differenceGeoJSON(difference: SpatialDifference, extent: SimExtent): GeoJSON.FeatureCollection<GeoJSON.Polygon, DifferenceFeatureProperties> {
  if (difference.status !== "controlled") return { type: "FeatureCollection", features: [] };
  const largest = Math.max(difference.summary.largestDecreaseM3, difference.summary.largestIncreaseM3, DIFFERENCE_EPSILON_M3);
  return {
    type: "FeatureCollection",
    features: difference.cells.slice(0, MAX_DIFFERENCE_CELLS).map((cell) => ({
      type: "Feature",
      properties: {
        row: cell.row,
        col: cell.col,
        delta_m3: cell.deltaM3,
        now_m3: cell.nowM3,
        possible_m3: cell.possibleM3,
        kind: cell.kind,
        reach_m: cell.reachM,
        share: Math.min(1, Math.abs(cell.deltaM3) / largest),
      },
      geometry: { type: "Polygon", coordinates: [cellRing(extent, cell.row, cell.col, difference.rows, difference.cols)] },
    })),
  };
}

const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

/** One or two plain sentences for a panel or a report. */
export function describeSpatialDifference(summary: SpatialDifferenceSummary): string {
  if (summary.changed === 0) return "The redesign changed no cell's routed water in this storm.";
  const parts: string[] = [];
  if (summary.less > 0) {
    const downstream = summary.downstreamCells > 0 ? `, ${summary.downstreamCells.toLocaleString("en-US")} of them downstream of the drawing` : "";
    const reach = summary.farthestReachM > 0 ? ` and as far as ${Math.round(summary.farthestReachM).toLocaleString("en-US")} m from it` : "";
    parts.push(`Less water passes through ${plural(summary.less, "cell")}${downstream}${reach}.`);
  }
  parts.push(summary.more > 0 ? `More water passes through ${plural(summary.more, "cell")}.` : "No cell carries more water.");
  return parts.join(" ");
}
