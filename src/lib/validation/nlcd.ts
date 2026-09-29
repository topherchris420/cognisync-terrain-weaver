import type { SimExtent } from "@/lib/hydrology/types";

/** Raw NLCD 2021 cells for one frame, as frozen by scripts/fetch-reference-data.ts. */
export interface NlcdGrid {
  bbox: SimExtent;
  cols: number;
  rows: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  landCover: number[];
  impervious: number[];
}

export const NLCD_OPEN_WATER = 11;
/** 0 = outside reprojected coverage; 250 = NLCD no-data. */
const NO_DATA = new Set([0, 250]);

/**
 * Reference composition (% of valid frame cells): open water, impervious
 * (mean percent imperviousness), and the pervious remainder.
 */
export function nlcdReference(grid: NlcdGrid) {
  let valid = 0;
  let water = 0;
  let impervious = 0;
  for (let row = 0; row < grid.rows; row += 1) {
    const lat = grid.y0 + row * grid.dy;
    if (lat < grid.bbox.south || lat > grid.bbox.north) continue;
    for (let col = 0; col < grid.cols; col += 1) {
      const lng = grid.x0 + col * grid.dx;
      if (lng < grid.bbox.west || lng > grid.bbox.east) continue;
      const i = row * grid.cols + col;
      const cls = grid.landCover[i];
      if (NO_DATA.has(cls)) continue;
      valid += 1;
      if (cls === NLCD_OPEN_WATER) water += 1;
      else impervious += Math.min(100, Math.max(0, grid.impervious[i])) / 100;
    }
  }
  if (valid === 0) throw new Error("NLCD grid has no valid cells inside the frame.");
  const w = (water / valid) * 100;
  const imp = (impervious / valid) * 100;
  return { cells: valid, water: w, impervious: imp, pervious: 100 - w - imp };
}
