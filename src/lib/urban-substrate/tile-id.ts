import { SUBSTRATE_GRID, SUBSTRATE_LEVELS, type SubstrateLevel } from "./config";
import { toLocal, toLonLat, quantizeDegrees, type XY } from "./projection";

/**
 * Stable tile identity derived only from position: `region/sizeM/ix/iy`,
 * e.g. `nyc/512/40/46`. ix grows east, iy grows north, from the grid origin.
 * The same location always has the same tile id, whatever data it holds.
 */
export interface TileKey {
  region: string;
  level: SubstrateLevel;
  sizeM: number;
  ix: number;
  iy: number;
}

const LEVEL_BY_SIZE = new Map<number, SubstrateLevel>(
  (Object.keys(SUBSTRATE_LEVELS) as SubstrateLevel[]).map((level) => [SUBSTRATE_LEVELS[level].tileSizeM, level]),
);

const TILE_ID = /^([a-z0-9-]+)\/(\d+)\/(-?\d+)\/(-?\d+)$/;

export function tileId(level: SubstrateLevel, ix: number, iy: number, region: string = SUBSTRATE_GRID.region): string {
  if (!Number.isInteger(ix) || !Number.isInteger(iy)) throw new Error(`Tile indices must be integers (got ${ix}, ${iy}).`);
  return `${region}/${SUBSTRATE_LEVELS[level].tileSizeM}/${ix}/${iy}`;
}

/** Parse a tile id; null when it is malformed or names an unknown tile size. */
export function parseTileId(id: string): TileKey | null {
  const match = TILE_ID.exec(id);
  if (!match) return null;
  const sizeM = Number(match[2]);
  const level = LEVEL_BY_SIZE.get(sizeM);
  if (!level) return null;
  return { region: match[1], level, sizeM, ix: Number(match[3]), iy: Number(match[4]) };
}

export function tileIndexForPoint(level: SubstrateLevel, [x, y]: XY): [number, number] {
  const size = SUBSTRATE_LEVELS[level].tileSizeM;
  return [Math.floor(x / size), Math.floor(y / size)];
}

export function tileIdForLonLat(level: SubstrateLevel, lon: number, lat: number): string {
  const [ix, iy] = tileIndexForPoint(level, toLocal(lon, lat));
  return tileId(level, ix, iy);
}

/** Tile extent in grid metres: [x0, y0, x1, y1]. */
export function tileBoundsM(level: SubstrateLevel, ix: number, iy: number): [number, number, number, number] {
  const size = SUBSTRATE_LEVELS[level].tileSizeM;
  return [ix * size, iy * size, (ix + 1) * size, (iy + 1) * size];
}

/** Tile extent as a WGS84 bbox [west, south, east, north], rounded to stored precision. */
export function tileBoundsLonLat(level: SubstrateLevel, ix: number, iy: number): [number, number, number, number] {
  const [x0, y0, x1, y1] = tileBoundsM(level, ix, iy);
  const [west, south] = toLonLat(x0, y0);
  const [east, north] = toLonLat(x1, y1);
  return [quantizeDegrees(west), quantizeDegrees(south), quantizeDegrees(east), quantizeDegrees(north)];
}

/** A bbox [west, south, east, north] in grid metres. */
export function bboxToLocal([west, south, east, north]: [number, number, number, number]): [number, number, number, number] {
  const [x0, y0] = toLocal(west, south);
  const [x1, y1] = toLocal(east, north);
  return [x0, y0, x1, y1];
}

/**
 * Every tile of a level that a metric box touches, in a fixed order
 * (south to north, west to east). Boxes are closed: a box ending exactly on a
 * tile edge does not pull in the next tile.
 */
export function tilesIntersectingM(level: SubstrateLevel, [x0, y0, x1, y1]: [number, number, number, number]): TileKey[] {
  if (!(x1 >= x0 && y1 >= y0)) throw new Error("A tile query box must have west ≤ east and south ≤ north.");
  const size = SUBSTRATE_LEVELS[level].tileSizeM;
  const ix0 = Math.floor(x0 / size);
  const iy0 = Math.floor(y0 / size);
  const ix1 = Math.max(ix0, Math.ceil(x1 / size) - 1);
  const iy1 = Math.max(iy0, Math.ceil(y1 / size) - 1);
  const keys: TileKey[] = [];
  for (let iy = iy0; iy <= iy1; iy += 1) {
    for (let ix = ix0; ix <= ix1; ix += 1) {
      keys.push({ region: SUBSTRATE_GRID.region, level, sizeM: size, ix, iy });
    }
  }
  return keys;
}

export function keyToId(key: TileKey): string {
  return tileId(key.level, key.ix, key.iy, key.region);
}

/** The context tile that contains a local tile. */
export function contextTileOf(localIx: number, localIy: number): [number, number] {
  const ratio = SUBSTRATE_LEVELS.context.tileSizeM / SUBSTRATE_LEVELS.local.tileSizeM;
  return [Math.floor(localIx / ratio), Math.floor(localIy / ratio)];
}

/** Stable ordering for tile ids: level, then south-to-north, then west-to-east. */
export function compareTileIds(a: string, b: string): number {
  const ka = parseTileId(a);
  const kb = parseTileId(b);
  if (!ka || !kb) return a < b ? -1 : a > b ? 1 : 0;
  return ka.sizeM - kb.sizeM || ka.iy - kb.iy || ka.ix - kb.ix;
}
