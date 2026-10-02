import type { SubstrateLevel } from "../config";
import type { RectM } from "../geometry";
import { roundTo, toLocal } from "../projection";
import type { RawNlcd } from "../sources";
import { tileId, tileIndexForPoint } from "../tile-id";
import type { AttributeSpec, LandCoverReferenceTile } from "../types";

export const NLCD_SOURCE = "usgs-nlcd-2021";
const OPEN_WATER = 11;
/** 0 = outside the reprojected coverage; 250 = NLCD no-data. */
const NO_DATA = new Set([0, 250]);

export const LAND_COVER_ATTRIBUTES: AttributeSpec[] = [
  { name: "classCounts", unit: "cells", evidence: "reference", source: NLCD_SOURCE, field: "land cover class", transform: "count of 30 m cells whose centre falls in the tile and the coverage" },
  { name: "reference", unit: "% of reference cells", evidence: "reference", source: NLCD_SOURCE, field: "class, impervious", transform: "water = class 11 share; impervious = mean percent imperviousness of non-water cells over all cells; pervious = remainder" },
];

/**
 * Reference land cover per tile from NLCD 2021. This is an independent map
 * product kept beside, never instead of, the app's AI classification: the
 * two are different evidence and the substrate never writes either into the other.
 */
export function landCoverByTile(raw: RawNlcd, coverage: RectM, level: SubstrateLevel): Map<string, LandCoverReferenceTile> {
  const acc = new Map<string, { cells: number; water: number; impervious: number; classes: Map<number, number> }>();
  for (let row = 0; row < raw.rows; row += 1) {
    const lat = raw.y0 + row * raw.dy;
    for (let col = 0; col < raw.cols; col += 1) {
      const lon = raw.x0 + col * raw.dx;
      const point = toLocal(lon, lat);
      if (point[0] < coverage[0] || point[0] >= coverage[2] || point[1] < coverage[1] || point[1] >= coverage[3]) continue;
      const i = row * raw.cols + col;
      const cls = raw.landCover[i];
      if (NO_DATA.has(cls)) continue;
      const [ix, iy] = tileIndexForPoint(level, point);
      const key = tileId(level, ix, iy);
      let entry = acc.get(key);
      if (!entry) acc.set(key, (entry = { cells: 0, water: 0, impervious: 0, classes: new Map() }));
      entry.cells += 1;
      entry.classes.set(cls, (entry.classes.get(cls) ?? 0) + 1);
      if (cls === OPEN_WATER) entry.water += 1;
      else entry.impervious += Math.min(100, Math.max(0, raw.impervious[i]));
    }
  }
  const out = new Map<string, LandCoverReferenceTile>();
  for (const [key, entry] of acc) {
    const water = (entry.water / entry.cells) * 100;
    const impervious = entry.impervious / entry.cells;
    out.set(key, {
      sourceId: NLCD_SOURCE,
      evidence: "reference",
      cells: entry.cells,
      classCounts: Object.fromEntries([...entry.classes.entries()].sort((a, b) => a[0] - b[0]).map(([code, count]) => [String(code), count])),
      reference: {
        waterPct: roundTo(water, 2),
        imperviousPct: roundTo(impervious, 2),
        perviousPct: roundTo(100 - water - impervious, 2),
      },
    });
  }
  return out;
}
