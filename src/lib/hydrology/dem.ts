import { stableHash } from "@/lib/counterfactual/hashing";
import type { ElevationGrid, SimExtent } from "./types";
import {
  chooseTileZoom,
  latToTileY,
  lngToTileX,
  sampleTerrarium,
  tilesForBBox,
  tileUrl,
  TERRARIUM_TILE_SIZE,
  type PixelBuffer,
} from "./terrarium";

const demCache = new Map<string, ElevationGrid>();

export function cacheKey(bbox: SimExtent, rows: number, cols: number): string {
  return stableHash({
    north: round4(bbox.north),
    south: round4(bbox.south),
    east: round4(bbox.east),
    west: round4(bbox.west),
    rows,
    cols,
  });
}

function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

function fnvGrid(values: number[][]): string {
  return stableHash(values);
}

/**
 * Deterministic fallback slope so paired NOW/POSSIBLE runs share a terrain
 * identity when live tiles are unreachable.
 */
export function syntheticElevation(
  bbox: SimExtent,
  rows: number,
  cols: number
): ElevationGrid {
  const values: number[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      const lat = bbox.north - ((row + 0.5) / rows) * (bbox.north - bbox.south);
      const lng = bbox.west + ((col + 0.5) / cols) * (bbox.east - bbox.west);
      const northing = (lat - bbox.south) / Math.max(1e-9, bbox.north - bbox.south);
      const easting = (lng - bbox.west) / Math.max(1e-9, bbox.east - bbox.west);
      return (
        18 +
        northing * 42 +
        Math.sin(lat * 48) * 6.5 +
        Math.cos(lng * 31) * 4.2 +
        easting * 7
      );
    })
  );
  return {
    values,
    rows,
    cols,
    status: "illustrative",
    hash: fnvGrid(values),
    sourceId: "mannahatta-synthetic-slope",
    warnings: [
      "Live elevation tiles were unavailable; a deterministic slope surface is in use. Flow paths are illustrative.",
    ],
  };
}

async function decodePngBuffer(
  blob: Blob
): Promise<PixelBuffer | null> {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0);
      const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      bitmap.close?.();
      return image;
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchTileBuffer(
  z: number,
  x: number,
  y: number,
  fetchImpl: typeof fetch
): Promise<PixelBuffer | null> {
  try {
    const response = await fetchImpl(tileUrl(z, x, y), {
      headers: { Accept: "image/png" },
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    return decodePngBuffer(blob);
  } catch {
    return null;
  }
}

export async function loadElevationGrid(
  bbox: SimExtent,
  rows: number,
  cols: number,
  fetchImpl: typeof fetch = fetch
): Promise<ElevationGrid> {
  const key = cacheKey(bbox, rows, cols);
  const cached = demCache.get(key);
  if (cached) return cached;

  try {
    const z = chooseTileZoom(bbox.west, bbox.south, bbox.east, bbox.north);
    const tiles = tilesForBBox(bbox.west, bbox.south, bbox.east, bbox.north, z);
    if (tiles.length === 0) {
      const fallback = syntheticElevation(bbox, rows, cols);
      demCache.set(key, fallback);
      return fallback;
    }

    const buffers = await Promise.all(
      tiles.map(async (tile) => ({
        ...tile,
        buffer: await fetchTileBuffer(tile.z, tile.x, tile.y, fetchImpl),
      }))
    );
    const lookup = new Map<string, PixelBuffer>();
    for (const tile of buffers) {
      if (tile.buffer) lookup.set(`${tile.z}/${tile.x}/${tile.y}`, tile.buffer);
    }
    if (lookup.size === 0) {
      const fallback = syntheticElevation(bbox, rows, cols);
      demCache.set(key, fallback);
      return fallback;
    }

    const values: number[][] = [];
    for (let row = 0; row < rows; row += 1) {
      const lat = bbox.north - ((row + 0.5) / rows) * (bbox.north - bbox.south);
      const line: number[] = [];
      for (let col = 0; col < cols; col += 1) {
        const lng = bbox.west + ((col + 0.5) / cols) * (bbox.east - bbox.west);
        const fx = lngToTileX(lng, z);
        const fy = latToTileY(lat, z);
        const tileX = Math.floor(fx);
        const tileY = Math.floor(fy);
        const buffer = lookup.get(`${z}/${tileX}/${tileY}`);
        if (!buffer) {
          line.push(Number.NaN);
          continue;
        }
        const px = (fx - tileX) * (buffer.width || TERRARIUM_TILE_SIZE);
        const py = (fy - tileY) * (buffer.height || TERRARIUM_TILE_SIZE);
        line.push(sampleTerrarium(buffer, px, py));
      }
      values.push(line);
    }

    const finite = values.flat().filter((value) => Number.isFinite(value));
    if (finite.length < rows * cols * 0.6) {
      const fallback = syntheticElevation(bbox, rows, cols);
      demCache.set(key, fallback);
      return fallback;
    }

    const mean =
      finite.reduce((sum, value) => sum + value, 0) / Math.max(1, finite.length);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (!Number.isFinite(values[row][col])) values[row][col] = mean;
      }
    }

    const observed: ElevationGrid = {
      values,
      rows,
      cols,
      status: "observed",
      hash: fnvGrid(values),
      sourceId: "mapzen-terrarium",
      warnings: [],
    };
    demCache.set(key, observed);
    return observed;
  } catch {
    const fallback = syntheticElevation(bbox, rows, cols);
    demCache.set(key, fallback);
    return fallback;
  }
}

export function rememberElevation(grid: ElevationGrid, bbox: SimExtent): void {
  demCache.set(cacheKey(bbox, grid.rows, grid.cols), grid);
}

export function clearElevationCache(): void {
  demCache.clear();
}
