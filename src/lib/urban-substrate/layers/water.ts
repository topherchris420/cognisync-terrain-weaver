import type { SubstrateLevel } from "../config";
import { geometryAreaM2, positionsToLocal, scanlineFill, type RectM } from "../geometry";
import { roundTo } from "../projection";
import type { RawShoreline, RawWaterBody } from "../sources";
import { tileBoundsM } from "../tile-id";
import type { AttributeSpec, WaterBodyFeature } from "../types";
import { byId, countIssues, inCanonicalOrder, integerId, normalizePolygonal, textOrNull } from "./common";

export const SHORELINE_SOURCE = "nyc-borough-boundaries-shoreline";
export const WATER_BODIES_SOURCE = "nyc-planimetric-hydrography";

/** Planimetric hydrography feature codes (Capture Rules, HYDROGRAPHY). */
export const WATER_FEATURE_TYPES: Record<string, string> = {
  "2600": "lake-reservoir",
  "2610": "pond",
  "2620": "river",
  "2630": "stream",
  "2640": "wetland-marsh",
  "2650": "beach-shoreline",
  "2660": "bay-ocean",
};

export const WATER_ATTRIBUTES: AttributeSpec[] = [
  { name: "mask", unit: null, evidence: "modeled", source: SHORELINE_SOURCE, field: "the_geom", transform: "cell centres inside shoreline-clipped borough land (even-odd scanline) are L, others W; N outside the declared coverage" },
  { name: "openWaterAreaM2", unit: "m²", evidence: "modeled", source: "derived", field: null, transform: "W cells × cell area" },
  { name: "bodies", unit: null, evidence: "measured", source: WATER_BODIES_SOURCE, field: "the_geom", transform: "inland water polygons, normalised like footprints" },
];

/** Land/water symbols. N is not water: it is the absence of a source record. */
export type MaskSymbol = "L" | "W" | "N";

export function encodeRle(symbols: string[]): string {
  let out = "";
  let i = 0;
  while (i < symbols.length) {
    let j = i;
    while (j < symbols.length && symbols[j] === symbols[i]) j += 1;
    out += `${symbols[i]}${j - i}`;
    i = j;
  }
  return out;
}

export function decodeRle(rle: string): MaskSymbol[] {
  const out: MaskSymbol[] = [];
  for (const [, symbol, count] of rle.matchAll(/([LWN])(\d+)/g)) {
    for (let k = 0; k < Number(count); k += 1) out.push(symbol as MaskSymbol);
  }
  return out;
}

/**
 * Land and open water over the coverage, from the shoreline. Open harbour
 * and river water is the complement of land; it is receiving water, never
 * retention capacity.
 */
export class LandWaterMask {
  readonly cellM: number;
  readonly rows: number;
  readonly cols: number;
  readonly west: number;
  readonly north: number;
  readonly land: Uint8Array;
  private readonly rings: Array<Array<[number, number]>>;
  private readonly coverage: RectM;

  constructor(shoreline: RawShoreline[], coverage: RectM, cellM: number) {
    this.coverage = coverage;
    this.rings = shoreline.flatMap((borough) => borough.rings.map((ring) => positionsToLocal(ring)));
    this.cellM = cellM;
    this.west = coverage[0];
    this.north = coverage[3];
    this.cols = Math.round((coverage[2] - coverage[0]) / cellM);
    this.rows = Math.round((coverage[3] - coverage[1]) / cellM);
    this.land = scanlineFill(this.rings, this.west, this.north, cellM, this.rows, this.cols);
  }

  symbolAtCell(row: number, col: number): MaskSymbol {
    if (row < 0 || col < 0 || row >= this.rows || col >= this.cols) return "N";
    return this.land[row * this.cols + col] ? "L" : "W";
  }

  symbolAt(x: number, y: number): MaskSymbol {
    return this.symbolAtCell(Math.floor((this.north - y) / this.cellM), Math.floor((x - this.west) / this.cellM));
  }

  cellCentre(row: number, col: number): [number, number] {
    return [this.west + (col + 0.5) * this.cellM, this.north - (row + 0.5) * this.cellM];
  }

  /** Nearest open-water cell centre within a radius, ties broken by row then column. */
  nearestWater(x: number, y: number, maxM: number): [number, number] | null {
    const row0 = Math.floor((this.north - y) / this.cellM);
    const col0 = Math.floor((x - this.west) / this.cellM);
    const reach = Math.ceil(maxM / this.cellM);
    let best: [number, number] | null = null;
    let bestDistance = maxM * maxM;
    for (let row = row0 - reach; row <= row0 + reach; row += 1) {
      for (let col = col0 - reach; col <= col0 + reach; col += 1) {
        if (this.symbolAtCell(row, col) !== "W") continue;
        const [cx, cy] = this.cellCentre(row, col);
        const distance = (cx - x) * (cx - x) + (cy - y) * (cy - y);
        if (distance <= bestDistance && (best === null || distance < bestDistance)) {
          bestDistance = distance;
          best = [cx, cy];
        }
      }
    }
    return best;
  }

  /** The mask of one tile at its level's cell size, as symbols row-major from the north row. */
  tileSymbols(level: SubstrateLevel, ix: number, iy: number, cellM: number): MaskSymbol[] {
    const [x0, , x1, y1] = tileBoundsM(level, ix, iy);
    const size = Math.round((x1 - x0) / cellM);
    const [cx0, cy0, cx1, cy1] = this.coverage;
    if (cellM === this.cellM) {
      const firstCol = Math.round((x0 - this.west) / this.cellM);
      const firstRow = Math.round((this.north - y1) / this.cellM);
      const out: MaskSymbol[] = [];
      for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) out.push(this.symbolAtCell(firstRow + r, firstCol + c));
      return out;
    }
    const land = scanlineFill(this.rings, x0, y1, cellM, size, size);
    const out: MaskSymbol[] = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const x = x0 + (c + 0.5) * cellM;
        const y = y1 - (r + 0.5) * cellM;
        const covered = x >= cx0 && x < cx1 && y >= cy0 && y < cy1;
        out.push(!covered ? "N" : land[r * size + c] ? "L" : "W");
      }
    }
    return out;
  }
}

export interface WaterBodyStats {
  input: number;
  kept: number;
  dropped: Record<string, number>;
  issues: Record<string, number>;
}

export function normalizeWaterBodies(rows: RawWaterBody[]): { features: WaterBodyFeature[]; stats: WaterBodyStats } {
  const stats: WaterBodyStats = { input: rows.length, kept: 0, dropped: {}, issues: {} };
  const seen = new Set<string>();
  const features: WaterBodyFeature[] = [];
  for (const row of inCanonicalOrder(rows)) {
    const sourceKey = integerId(row.source_id);
    const id = sourceKey ? `water:${sourceKey}` : null;
    if (!id || seen.has(id)) {
      stats.dropped[id ? "duplicate-id" : "no-identifier"] = (stats.dropped[id ? "duplicate-id" : "no-identifier"] ?? 0) + 1;
      continue;
    }
    const { geometry, issues } = normalizePolygonal(row.the_geom);
    countIssues(stats.issues, issues);
    if (!geometry) {
      stats.dropped["unusable-geometry"] = (stats.dropped["unusable-geometry"] ?? 0) + 1;
      continue;
    }
    seen.add(id);
    const featureCode = integerId(row.feat_code);
    features.push({
      id,
      sourceId: WATER_BODIES_SOURCE,
      name: textOrNull(row.name, ["unset"]),
      featureCode,
      featureType: featureCode ? WATER_FEATURE_TYPES[featureCode] ?? null : null,
      geometry,
      areaM2: roundTo(geometryAreaM2(geometry), 2),
      geometryIssues: issues,
    });
  }
  features.sort(byId);
  stats.kept = features.length;
  return { features, stats };
}
