import { buffer, lineString } from "@turf/turf";
import { fillAndSpill, isReceivingWater } from "@/lib/hydrology/conditioning";
import type { SimExtent, StormCellGrid } from "@/lib/hydrology/types";

/**
 * A STARTING SKETCH ALONG THE MODELED FLOW PATHS.
 *
 * A first-time visitor reaching Mitigation faces an empty map and a polygon
 * tool. This proposes a few bioswale strips that they can test at once and
 * then edit, delete or add to like their own drawings.
 *
 * The strips follow the upper reaches of the longest modeled flow paths:
 * where the routed water first gathers into a line that then runs a long way
 * downhill. That is a choice for legibility, not for effect. In this model a
 * drawn surface changes only the rain that lands on it; it does not intercept
 * water arriving from upstream. Placement therefore mainly changes where the
 * reduction travels, and putting it at the head of a long path lets the
 * spatial difference show it travelling. It is not a siting recommendation,
 * and routed accumulation is not flood likelihood (routing/R5).
 *
 * Deterministic: the same routed storm always yields the same sketch.
 */

export const FLOW_SKETCH_CAVEAT =
  "A starting point for exploring, not a siting recommendation. In this model a shape removes only the rain that falls on it; it does not catch water flowing in from upstream, so where you place it mainly changes where its effect travels downstream.";

export interface FlowSketchInput {
  /** The extent the storm was routed on. */
  extent: SimExtent;
  /** The elevation grid the storm was routed on (rows × cols, north row first). */
  elevation: number[][];
  /** The baseline (NOW) run's per-cell grids. */
  cells: StormCellGrid;
  rainfallDepthMm: number;
  /**
   * The flow paths drawn on the map (cell-centre polylines, head first). When
   * given, strips sit only on these, so "along the flow paths" means the lines
   * the visitor can see; otherwise any cell above the engine's path threshold.
   */
  visiblePaths?: Array<{ points: [number, number][] }>;
  /** Strips to propose at most. */
  maxShapes?: number;
  /** Length of each strip along its flow path, metres. */
  reachM?: number;
  /** Half the strip's width, metres (a 6 m wide swale by default). */
  halfWidthM?: number;
}

export interface FlowSketchShape {
  geometry: GeoJSON.Polygon;
  /** Grid cells the strip's centreline follows, upstream first, as [row, col]. */
  path: Array<[number, number]>;
  /** Cells the flow path continues for below the strip before it ends. */
  downstreamCells: number;
}

/** Same threshold the engine uses to draw a flow path: four cells' worth of rain. */
const PATH_RAIN_CELLS = 4;
/** Strips keep at least this many cells (Chebyshev) between them. */
const SPACING_CELLS = 3;

function cellCentre(extent: SimExtent, rows: number, cols: number, row: number, col: number): [number, number] {
  const latitudeStep = (extent.north - extent.south) / rows;
  const longitudeStep = (extent.east - extent.west) / cols;
  return [extent.west + (col + 0.5) * longitudeStep, extent.north - (row + 0.5) * latitudeStep];
}

/** Grid cells under the drawn flow paths, or null when none land on this grid. */
function visibleCells(
  extent: SimExtent,
  rows: number,
  cols: number,
  paths: FlowSketchInput["visiblePaths"]
): boolean[][] | null {
  if (!paths?.length) return null;
  const latitudeStep = (extent.north - extent.south) / rows;
  const longitudeStep = (extent.east - extent.west) / cols;
  const grid = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  let marked = 0;
  for (const path of paths) {
    for (const [lng, lat] of path.points) {
      const row = Math.floor((extent.north - lat) / latitudeStep);
      const col = Math.floor((lng - extent.west) / longitudeStep);
      if (row < 0 || col < 0 || row >= rows || col >= cols || grid[row][col]) continue;
      grid[row][col] = true;
      marked += 1;
    }
  }
  return marked > 0 ? grid : null;
}

export function sketchAlongFlowPaths({
  extent,
  elevation,
  cells,
  rainfallDepthMm,
  visiblePaths,
  maxShapes = 6,
  reachM = 60,
  halfWidthM = 3,
}: FlowSketchInput): FlowSketchShape[] {
  const { rows, cols, cellAreaM2 } = cells;
  if (
    rows < 3 ||
    cols < 3 ||
    elevation.length !== rows ||
    elevation.some((row) => row.length !== cols) ||
    cells.generatedM3.length !== rows ||
    !(cellAreaM2 > 0) ||
    !(rainfallDepthMm > 0)
  ) {
    return [];
  }

  // The routing the engine performed, recomputed from the same inputs.
  const { receivers, accumulation } = fillAndSpill(elevation, cells.generatedM3, cellAreaM2);
  const threshold = PATH_RAIN_CELLS * (rainfallDepthMm / 1000) * cellAreaM2;
  const land = (r: number, c: number) => !isReceivingWater(elevation[r][c]);
  const visible = visibleCells(extent, rows, cols, visiblePaths);
  const onPath = (r: number, c: number) =>
    land(r, c) && (visible ? visible[r][c] : accumulation[r][c] > threshold);
  const isSink = (r: number, c: number) => receivers[r][c][0] === r && receivers[r][c][1] === c;

  // A path head is a path cell that no other path cell drains into.
  const fedByPath = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!onPath(r, c) || isSink(r, c)) continue;
      const [nr, nc] = receivers[r][c];
      fedByPath[nr][nc] = true;
    }
  }

  const cellSizeM = Math.sqrt(cellAreaM2);
  const reachCells = Math.max(2, Math.ceil(reachM / cellSizeM));

  const candidates: Array<{ chain: Array<[number, number]>; head: [number, number] }> = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (!onPath(r, c) || fedByPath[r][c] || isSink(r, c)) continue;
      const chain: Array<[number, number]> = [];
      const seen = new Set<number>();
      let row = r;
      let col = c;
      while (!seen.has(row * cols + col) && land(row, col)) {
        seen.add(row * cols + col);
        chain.push([row, col]);
        if (isSink(row, col)) break;
        [row, col] = receivers[row][col];
      }
      // The strip itself must sit on land and drain somewhere further on.
      if (chain.length > reachCells) candidates.push({ chain, head: [r, c] });
    }
  }

  // Longest paths first; ties broken by position so the sketch is reproducible.
  candidates.sort(
    (left, right) =>
      right.chain.length - left.chain.length ||
      left.head[0] - right.head[0] ||
      left.head[1] - right.head[1]
  );

  const taken: Array<[number, number]> = [];
  const tooClose = (r: number, c: number) =>
    taken.some(([tr, tc]) => Math.max(Math.abs(tr - r), Math.abs(tc - c)) < SPACING_CELLS);

  const shapes: FlowSketchShape[] = [];
  for (const candidate of candidates) {
    if (shapes.length >= maxShapes) break;
    const path = candidate.chain.slice(0, reachCells);
    if (path.some(([r, c]) => tooClose(r, c))) continue;
    const centreline = lineString(path.map(([r, c]) => cellCentre(extent, rows, cols, r, c)));
    const strip = buffer(centreline, halfWidthM, { units: "meters", steps: 4 });
    if (!strip || strip.geometry.type !== "Polygon") continue;
    taken.push(...path);
    shapes.push({
      geometry: strip.geometry,
      path,
      downstreamCells: candidate.chain.length - path.length,
    });
  }
  return shapes;
}
