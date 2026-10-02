import { COORDINATE_DECIMALS, SUBSTRATE_GRID } from "./config";

export type LonLat = [number, number];
export type XY = [number, number];

const G = SUBSTRATE_GRID;
/** Exact powers of ten, as literals (`**` may be approximated by an engine). */
const POWERS_OF_TEN = [1, 10, 100, 1000, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
const SCALE = POWERS_OF_TEN[COORDINATE_DECIMALS];

/** WGS84 lon/lat → local grid metres (x east, y north). Basic arithmetic only. */
export function toLocal(lon: number, lat: number): XY {
  return [(lon - G.originLon) * G.metresPerDegLon, (lat - G.originLat) * G.metresPerDegLat];
}

/** Local grid metres → WGS84 lon/lat. */
export function toLonLat(x: number, y: number): LonLat {
  return [G.originLon + x / G.metresPerDegLon, G.originLat + y / G.metresPerDegLat];
}

/** Never emit -0: it would canonicalize the same but read differently in diffs. */
function noNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/** Round a coordinate to the stored precision (1e-7°, about 1 cm). */
export function quantizeDegrees(value: number): number {
  return noNegativeZero(Math.round(value * SCALE) / SCALE);
}

export function quantizeLonLat([lon, lat]: LonLat): LonLat {
  return [quantizeDegrees(lon), quantizeDegrees(lat)];
}

/** Round a metric quantity (length, area, height) to a fixed step for storage. */
export function roundTo(value: number, decimals: number): number {
  const factor = POWERS_OF_TEN[decimals];
  if (factor === undefined) throw new Error(`Unsupported rounding precision ${decimals}.`);
  return noNegativeZero(Math.round(value * factor) / factor);
}

export const FEET_TO_METRES = 0.3048;
